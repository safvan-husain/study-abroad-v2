"""Advisor LangGraph — routing, discovery, and guidance over catalog state.

Canonical context is **not** loaded inside this graph. Before every invoke the AI
worker reads a fresh SpacetimeDB snapshot and passes it as input state:

- ``catalog_areas``, ``catalog_families``, ``catalog_courses`` — catalogue tables
- ``profile``, ``selection_context``, ``ui_context`` — per-conversation truth
- ``task``, ``graph_version`` — which top-level path ``route_task`` selects

See ``agent_server.initial_state`` for documented invoke shapes
(``initial_discover_state``, ``initial_course_fit_state``).

Checkpoint / thread history may retain past messages, but catalog and selection
channels on each run reflect the worker's latest read — never stale checkpoint
catalog as authoritative truth.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Callable

from langchain_core.messages import BaseMessage, HumanMessage
from langgraph.graph import END, START, StateGraph

from agent_server.state import AdvisorState, RouteDecision, ScopeDecision
from agent_server.state_updates import (
    build_advisor_result,
    build_branch_area_overview,
    build_branch_clarification,
    build_branch_comparison,
    build_branch_family_offerings,
    build_branch_guidance,
    build_branch_selection_proposal,
    complete_advisor_turn,
    complete_course_fit_turn,
    complete_discovery_turn,
    empty_profile,
    set_branch_result,
    set_route_decision,
    set_scope_decision,
)


def _latest_human_text(messages: list[BaseMessage] | list[Any]) -> str:
    for message in reversed(messages):
        message_type = getattr(message, "type", None) or (message.get("type") if isinstance(message, dict) else None)
        role = getattr(message, "role", None) or (message.get("role") if isinstance(message, dict) else None)
        if isinstance(message, HumanMessage) or message_type == "human" or role == "human":
            content = getattr(message, "content", None) or (message.get("content") if isinstance(message, dict) else "")
            return content if isinstance(content, str) else str(content)
    return ""


def _extract_json(text: str) -> dict[str, Any] | None:
    candidate = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", candidate, re.S | re.I)
    if fenced:
        candidate = fenced.group(1)
    else:
        start, end = candidate.find("{"), candidate.rfind("}")
        if start >= 0 and end > start:
            candidate = candidate[start : end + 1]
    try:
        parsed = json.loads(candidate)
        return parsed if isinstance(parsed, dict) else None
    except (TypeError, ValueError):
        return None


def _ollama_chat(system: str, human: str, model: str | None = None) -> str | None:
    if os.getenv("OLLAMA_DISABLED", "").lower() in {"1", "true", "yes"}:
        return None
    host = os.getenv("OLLAMA_HOST", "").rstrip("/")
    selected_model = model or os.getenv("GUIDANCE_MODEL", os.getenv("OLLAMA_MODEL", "gemma4:31b"))
    api_key = os.getenv("OLLAMA_API_KEY", "")
    try:
        timeout_seconds = max(1.0, min(float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "30")), 120.0))
    except ValueError:
        timeout_seconds = 30.0
    if not host:
        return None
    try:
        import httpx

        response = httpx.post(
            f"{host}/api/chat",
            headers={"Authorization": f"Bearer {api_key}"} if api_key else None,
            json={
                "model": selected_model,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": human}],
                "stream": False,
                "options": {"temperature": 0},
            },
            timeout=timeout_seconds,
        )
        response.raise_for_status()
        content = response.json().get("message", {}).get("content")
        return content if isinstance(content, str) else None
    except Exception:
        return None


def _ollama_json(
    system: str,
    payload: dict[str, Any],
    model: str,
    validate: Callable[[dict[str, Any]], dict[str, Any] | None],
) -> dict[str, Any] | None:
    correction = ""
    for _attempt in range(2):
        response = _ollama_chat(
            f"{system}\nReturn one JSON object only. Do not use markdown.{correction}",
            json.dumps(payload, separators=(",", ":"), ensure_ascii=False),
            model,
        )
        parsed = _extract_json(response or "")
        validated = validate(parsed or {})
        if validated is not None:
            return validated
        correction = "\nYour previous response failed schema validation. Correct the JSON and use only allowed enum values and supplied IDs."
    return None


def _validate_route(value: dict[str, Any]) -> RouteDecision | None:
    intent = value.get("intent")
    reason = value.get("reason")
    question = value.get("clarificationQuestion", "")
    if intent not in {"guidance", "discovery", "clarify"} or not isinstance(reason, str) or not reason.strip():
        return None
    if intent == "clarify" and (not isinstance(question, str) or not question.strip()):
        return None
    return {"intent": intent, "reason": reason[:512], "clarificationQuestion": str(question)[:512]}


def _validate_scope(value: dict[str, Any], state: AdvisorState) -> ScopeDecision | None:
    allowed = {"area_overview", "family_offerings", "all_area_offerings", "compare_offerings", "personalize_selection", "clarify"}
    scope = value.get("scope")
    explanation = value.get("explanation")
    if scope not in allowed or not isinstance(explanation, str) or not explanation.strip():
        return None
    areas = {str(row.get("areaId")) for row in state.get("catalog_families", [])}
    families = {str(row.get("familyId")) for row in state.get("catalog_families", [])}
    offerings = {str(row.get("courseId")) for row in state.get("catalog_courses", [])}
    area_id = str(value.get("areaId") or "")
    family_ids = [str(row) for row in (value.get("familyIds") or [])]
    offering_ids = [str(row) for row in (value.get("offeringIds") or [])]
    question = str(value.get("clarificationQuestion") or "")
    comparison_criterion = str(value.get("comparisonCriterion") or "")[:128]
    if area_id and area_id not in areas:
        return None
    if any(row not in families for row in family_ids) or any(row not in offerings for row in offering_ids):
        return None
    if scope == "area_overview" and not area_id:
        return None
    if scope == "family_offerings" and not family_ids:
        return None
    if scope == "all_area_offerings" and not area_id and not family_ids:
        return None
    if scope == "personalize_selection" and not offering_ids:
        return None
    if scope == "compare_offerings" and not 2 <= len(offering_ids) <= 4:
        return None
    if scope == "compare_offerings" and not comparison_criterion.strip():
        return None
    message = _latest_human_text(state.get("messages", [])).lower()
    comparison_cues = ("compare", "comparison", "difference between", "versus", " vs ", "which is better", "which university", "between")
    if scope == "compare_offerings" and message and not any(cue in f" {message} " for cue in comparison_cues):
        return None
    if scope == "clarify" and not question.strip():
        return None
    return {
        "scope": scope,
        "areaId": area_id,
        "familyIds": list(dict.fromkeys(family_ids))[:100],
        "offeringIds": list(dict.fromkeys(offering_ids))[:5],
        "explanation": explanation[:1024],
        "clarificationQuestion": question[:512],
        "comparisonCriterion": comparison_criterion,
    }


def _requests_all_presented(message: str, selection: dict[str, Any]) -> bool:
    normalized = " ".join(message.lower().split())
    references_presented = bool(re.search(r"\b(these|those|them)\b", normalized))
    asks_to_show_all = bool(re.search(r"\b(show|list|display)\b", normalized) and re.search(r"\ball\b", normalized))
    return references_presented and asks_to_show_all and bool(selection.get("presentedFamilyIds"))


def route_intent(state: AdvisorState) -> dict[str, Any]:
    text = _latest_human_text(state.get("messages", []))
    selection = state.get("selection_context", {})
    decision = _ollama_json(
        "Classify the latest student message. guidance means general study-abroad knowledge, journey help, or help using the advisor. "
        "discovery means exploring course areas, course types, exact university offerings, comparisons, preferences, or recommendations. "
        "A command such as 'show all these' is discovery when presentedFamilyIds are supplied; the scope resolver will resolve what 'these' means. "
        "If both are materially requested, or the request cannot safely be assigned, choose clarify and ask one concise question. "
        "Schema: {intent: guidance|discovery|clarify, reason: string, clarificationQuestion: string}.",
        {
            "message": text, "uiContext": state.get("ui_context", {}), "profile": state.get("profile", {}),
            "presentedFamilyIds": selection.get("presentedFamilyIds", []),
            "presentedOfferingIds": selection.get("presentedOfferingIds", []),
        },
        os.getenv("ROUTER_MODEL", "gpt-oss:20b"),
        _validate_route,
    )
    if decision is not None and decision["intent"] == "clarify" and _requests_all_presented(text, selection):
        decision = {
            "intent": "discovery",
            "reason": "The display command resolves to the canonically presented course types.",
            "clarificationQuestion": "",
        }
    if decision is None:
        decision = {
            "intent": "clarify",
            "reason": "The router model did not return a valid decision after one correction.",
            "clarificationQuestion": "Would you like help understanding the study-abroad process, or would you like to explore courses?",
        }
    return set_route_decision(decision)


def route_after_intent(state: AdvisorState) -> str:
    return str(state.get("route_decision", {}).get("intent") or "clarify")


def guidance_agent(state: AdvisorState) -> dict[str, Any]:
    text = _latest_human_text(state.get("messages", []))
    content = _ollama_chat(
        "You are the guidance specialist. Help the student understand general study-abroad knowledge and how to use this advisor. "
        "The journey is: explore course types and exact offerings, optionally compare, create an editable provisional list, confirm it, then collect required documents. "
        "Browsing never creates a shortlist. Confirmation is a separate action. Document review and eligibility decisions are not available in this release. "
        "Do not select courses, change profile facts, compare universities, or claim admissions outcomes. Answer concisely and suggest one useful next step.",
        json.dumps({"message": text, "profile": state.get("profile", {}), "uiContext": state.get("ui_context", {})}),
        os.getenv("GUIDANCE_MODEL", "gemma4:31b"),
    )
    if not content:
        content = "I could not complete that guidance response safely. Please try again or ask a more specific question about the process or how to use the advisor."
    return set_branch_result(build_branch_guidance(content))


def resolve_catalog_scope(state: AdvisorState) -> dict[str, Any]:
    families = state.get("catalog_families", [])
    courses = state.get("catalog_courses", [])
    compact_families = [{
        "familyId": row.get("familyId"), "areaId": row.get("areaId"), "name": row.get("name"),
        "aliases": row.get("aliases", []), "offeringCount": sum(1 for course in courses if course.get("familyId") == row.get("familyId")),
    } for row in families]
    selection = state.get("selection_context", {})
    message = _latest_human_text(state.get("messages", []))
    decision = _ollama_json(
        "Resolve the current message's catalog exploration scope using only supplied IDs. The current message is authoritative. UI context and presented IDs exist only "
        "to resolve references such as 'these' or 'the two'; never continue or repeat an earlier comparison unless the current message asks for comparison. "
        "area_overview: broad interest or an interest statement such as 'I want computer science', including when the current UI happens to show exact offerings; "
        "include every relevant nearby course type so differences can be explained. family_offerings: explicit display command for one or more exact course types. "
        "all_area_offerings: explicit request to show all offerings in an area or all previously presented types. compare_offerings: compare 2-4 exact university offerings; "
        "facts and rankings must come only from supplied offerings, and comparisonCriterion names the requested fact or 'overall'. personalize_selection: preference, recommendation, "
        "or explicit choice; propose 1-5 exact offering IDs. clarify: 'show me courses' without usable context or an ambiguous scope. Negative preferences must affect the decision; "
        "do not map 'I dislike coding' to computing merely because coding appears. For compare_offerings, comparisonCriterion is required and must name "
        "the user's requested criterion (for example, 'ranking'); use 'overall' only when the user did not specify one. For all other scopes, return an empty string. "
        "Schema: {scope, areaId, familyIds, offeringIds, explanation, clarificationQuestion, comparisonCriterion}.",
        {
            "message": message,
            "families": compact_families,
            "offerings": courses,
            "profile": state.get("profile", {}),
            "uiContext": state.get("ui_context", {}),
            "presentedFamilyIds": selection.get("presentedFamilyIds", []),
            "presentedOfferingIds": selection.get("presentedOfferingIds", []),
            "provisionalOfferingIds": selection.get("provisionalOfferingIds", []),
            "suppressedOfferingIds": selection.get("suppressedOfferingIds", []),
        },
        os.getenv("DISCOVERY_MODEL", "qwen3.5:397b"),
        lambda value: _validate_scope(value, state),
    )
    if _requests_all_presented(message, selection):
        decision = {
            "scope": "all_area_offerings", "areaId": "",
            "familyIds": [str(row) for row in selection.get("presentedFamilyIds", [])],
            "offeringIds": [], "explanation": "Show every offering from the previously presented course types.",
            "clarificationQuestion": "", "comparisonCriterion": "",
        }
    if decision is None:
        decision = {
            "scope": "clarify", "areaId": "", "familyIds": [], "offeringIds": [],
            "explanation": "The discovery model did not return a valid decision after one correction.",
            "clarificationQuestion": "Would you like to explore course areas, one course type, or every course within an area?", "comparisonCriterion": "",
        }
    return set_scope_decision(decision)


def route_after_scope(state: AdvisorState) -> str:
    return str(state.get("scope_decision", {}).get("scope") or "clarify")


def _family_ids_for_scope(state: AdvisorState) -> list[str]:
    scope = state.get("scope_decision", {})
    supplied = [str(row) for row in scope.get("familyIds", [])]
    if supplied:
        return supplied
    area_id = str(scope.get("areaId") or "")
    return [str(row.get("familyId")) for row in state.get("catalog_families", []) if row.get("areaId") == area_id]


def explain_course_types(state: AdvisorState) -> dict[str, Any]:
    area_id = str(state.get("scope_decision", {}).get("areaId") or "")
    family_ids = [
        str(row.get("familyId")) for row in state.get("catalog_families", [])
        if row.get("areaId") == area_id
    ]
    families = [row for row in state.get("catalog_families", []) if row.get("familyId") in family_ids]
    return set_branch_result(build_branch_area_overview(family_ids, len(families)))


def _load_offerings(state: AdvisorState, all_area: bool) -> dict[str, Any]:
    family_ids = _family_ids_for_scope(state)
    courses = [row for row in state.get("catalog_courses", []) if row.get("familyId") in family_ids]
    offering_ids = [str(row.get("courseId")) for row in courses]
    return set_branch_result(
        build_branch_family_offerings(
            family_ids,
            offering_ids,
            len(courses),
            all_area=all_area,
        )
    )


def load_all_family_offerings(state: AdvisorState) -> dict[str, Any]:
    return _load_offerings(state, False)


def load_all_area_offerings(state: AdvisorState) -> dict[str, Any]:
    return _load_offerings(state, True)


def personalize_selection(state: AdvisorState) -> dict[str, Any]:
    scope = state.get("scope_decision", {})
    offering_ids = [str(row) for row in scope.get("offeringIds", [])][:5]
    courses = [row for row in state.get("catalog_courses", []) if row.get("courseId") in offering_ids]
    ordered = sorted(courses, key=lambda row: offering_ids.index(str(row.get("courseId"))))
    offering_ids = [str(row.get("courseId")) for row in ordered]
    return set_branch_result(
        build_branch_selection_proposal(
            offering_ids,
            list(dict.fromkeys(str(row.get("familyId")) for row in ordered)),
            str(scope.get("explanation") or ""),
        )
    )


def compare_offerings(state: AdvisorState) -> dict[str, Any]:
    scope = state.get("scope_decision", {})
    offering_ids = [str(row) for row in scope.get("offeringIds", [])][:4]
    courses = [row for offering_id in offering_ids for row in state.get("catalog_courses", []) if row.get("courseId") == offering_id]
    criterion = str(scope.get("comparisonCriterion") or "overall")
    return set_branch_result(
        build_branch_comparison(
            offering_ids,
            list(dict.fromkeys(str(row.get("familyId")) for row in courses)),
            len(courses),
            criterion,
            str(scope.get("explanation") or "I can explain the trade-offs in your context."),
        )
    )


def clarification(state: AdvisorState) -> dict[str, Any]:
    question = str(state.get("route_decision", {}).get("clarificationQuestion") or "Would you like guidance or course discovery?")
    return set_branch_result(build_branch_clarification(question))


def clarify_catalog_scope(state: AdvisorState) -> dict[str, Any]:
    question = str(state.get("scope_decision", {}).get("clarificationQuestion") or "Would you like course areas, one course type, or everything within an area?")
    return set_branch_result(build_branch_clarification(question))


def _finalize(state: AdvisorState) -> dict[str, Any]:
    return complete_advisor_turn(
        build_advisor_result(state, latest_human_text=_latest_human_text(state.get("messages", [])))
    )


def validate_discovery(state: AdvisorState) -> dict[str, Any]:
    return _finalize(state)


def validate_guidance(state: AdvisorState) -> dict[str, Any]:
    return _finalize(state)


# Legacy path remains selectable while the specialist graph is rolled out.
AREA_ALIASES: dict[str, list[str]] = {
    "computing": ["programming", "computer science", "software", "coding", "tech", "it"],
    "business": ["business", "management", "mba", "entrepreneur", "commerce"],
    "engineering": ["engineering", "mechanical", "civil engineering", "electrical"],
}


def _map_phrase(phrase: str, catalog_areas: list[str]) -> dict[str, Any]:
    raw = phrase.strip()[:256]
    normalized = raw.lower()
    matches = []
    for area in catalog_areas:
        labels = [area.lower().replace("_", " "), *AREA_ALIASES.get(area.lower(), [])]
        if any(re.search(rf"(?:^|[^a-z0-9_]){re.escape(label)}(?:$|[^a-z0-9_])", normalized, re.I) for label in labels if label):
            matches.append(area)
    return {"studentPhrase": raw, "catalogAreas": matches[:8], "status": "mapped" if matches else "unmapped"}


_DISALLOWED_FIT_CLAIMS = re.compile(r"\b(admission|admitted|visa|scholarship|eligible|eligibility|approved|approval|guaranteed?|guarantee)\b", re.I)


def _is_indicative_fit_text(text: str) -> bool:
    normalized = " ".join(text.split())
    return bool(normalized) and len(normalized) <= 2000 and _DISALLOWED_FIT_CLAIMS.search(normalized) is None


def run_discovery(state: AdvisorState) -> dict[str, Any]:
    text = _latest_human_text(state.get("messages", []))
    intent = _map_phrase(text, state.get("catalog_areas", []))
    mapped = intent["status"] == "mapped"
    phrase = intent["studentPhrase"] or "that interest"
    assistant = f"Thanks — I am looking through partner courses related to {phrase}." if mapped else f"I could not map {phrase} to an exact catalogue area yet."
    return complete_discovery_turn(
        {
            "assistantContent": assistant,
            "profilePatch": empty_profile(state.get("profile")),
            "discoveryIntent": intent,
            "directive": {"type": "catalog" if mapped else "discovery", "awareness": assistant},
            "workItems": [],
            "workKind": "",
        }
    )


def run_course_fit(state: AdvisorState) -> dict[str, Any]:
    course = state.get("course", {})
    profile = state.get("profile", {})
    phrase = str(profile.get("studentPhrase") or course.get("studentPhrase") or "your interests")
    detail = f"This {course.get('area') or 'partner'} programme at {course.get('institutionName') or 'a partner university'} is an indicative fit for someone interested in {phrase}."
    return complete_course_fit_turn(
        {
            "entityType": "course",
            "entityId": str(course.get("courseId") or ""),
            "title": str(course.get("name") or "Course match")[:256],
            "detail": detail,
            "institutionName": str(course.get("institutionName") or "")[:256],
            "area": str(course.get("area") or "")[:64],
            "country": str(course.get("country") or "")[:64],
            "studentPhrase": phrase[:256],
        }
    )


def route_task(state: AdvisorState) -> str:
    # Specialist path assumes catalog/profile/selection were injected at invoke — see module docstring.
    if state.get("task") == "course_fit":
        return "course_fit"
    version = str(state.get("graph_version") or os.getenv("ADVISOR_GRAPH_VERSION", "specialist"))
    return "legacy" if version == "legacy" else "specialist"


builder = StateGraph(AdvisorState)
builder.add_node("legacy_discover", run_discovery)
builder.add_node("course_fit", run_course_fit)
builder.add_node("route_intent", route_intent)
builder.add_node("guidance_agent", guidance_agent)
builder.add_node("resolve_catalog_scope", resolve_catalog_scope)
builder.add_node("explain_course_types", explain_course_types)
builder.add_node("load_all_family_offerings", load_all_family_offerings)
builder.add_node("load_all_area_offerings", load_all_area_offerings)
builder.add_node("personalize_selection", personalize_selection)
builder.add_node("compare_offerings", compare_offerings)
builder.add_node("clarification", clarification)
builder.add_node("clarify_catalog_scope", clarify_catalog_scope)
builder.add_node("validate_discovery", validate_discovery)
builder.add_node("validate_guidance", validate_guidance)
builder.add_conditional_edges(START, route_task, {
    "legacy": "legacy_discover", "course_fit": "course_fit", "specialist": "route_intent",
})
builder.add_edge("legacy_discover", END)
builder.add_edge("course_fit", END)
builder.add_conditional_edges("route_intent", route_after_intent, {
    "guidance": "guidance_agent", "discovery": "resolve_catalog_scope", "clarify": "clarification",
})
builder.add_edge("guidance_agent", "validate_guidance")
builder.add_edge("validate_guidance", END)
builder.add_edge("clarification", "validate_discovery")
builder.add_conditional_edges("resolve_catalog_scope", route_after_scope, {
    "area_overview": "explain_course_types", "family_offerings": "load_all_family_offerings",
    "all_area_offerings": "load_all_area_offerings", "personalize_selection": "personalize_selection",
    "compare_offerings": "compare_offerings",
    "clarify": "clarify_catalog_scope",
})
for node in ["explain_course_types", "load_all_family_offerings", "load_all_area_offerings", "compare_offerings", "personalize_selection", "clarify_catalog_scope"]:
    builder.add_edge(node, "validate_discovery")
builder.add_edge("validate_discovery", END)
graph = builder.compile()

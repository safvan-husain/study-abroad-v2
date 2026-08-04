from __future__ import annotations

import json
import os
import re
from typing import Annotated, Any, Callable, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages


class AdvisorState(TypedDict, total=False):
    messages: Annotated[list[BaseMessage], add_messages]
    task: str
    graph_version: str
    catalog_areas: list[str]
    catalog_families: list[dict[str, Any]]
    catalog_courses: list[dict[str, Any]]
    profile: dict[str, Any]
    ui_context: dict[str, Any]
    selection_context: dict[str, Any]
    course: dict[str, Any]
    canonical_context_loaded: bool
    route_decision: dict[str, Any]
    scope_decision: dict[str, Any]
    branch_result: dict[str, Any]
    advisor_result: dict[str, Any]
    discovery_result: dict[str, Any]
    course_fit_result: dict[str, Any]


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


def _empty_profile(existing: dict[str, Any] | None = None) -> dict[str, Any]:
    existing = existing or {}
    return {
        "background": str(existing.get("background") or "")[:1024],
        "courseInterests": str(existing.get("courseInterests") or "")[:1024],
        "ambitions": str(existing.get("ambitions") or "")[:1024],
        "primaryArea": str(existing.get("primaryArea") or "")[:64],
        "candidateAreas": [str(row)[:64] for row in (existing.get("candidateAreas") or [])][:8],
        "studentPhrase": str(existing.get("studentPhrase") or "")[:256],
        "constraintsText": str(existing.get("constraintsText") or "")[:1024],
    }


def _safe_clarification(question: str, reason: str = "The advisor needs one choice before continuing.") -> dict[str, Any]:
    return {
        "assistantContent": question,
        "route": {"intent": "clarify", "reason": reason, "clarificationQuestion": question},
        "proposal": {"mode": "none", "offeringIds": [], "rationale": ""},
        "presentedFamilyIds": [],
        "presentedOfferingIds": [],
        "directive": {"type": "discovery", "awareness": "Waiting for your choice."},
        "workItems": [],
        "workKind": "",
    }


def _validate_route(value: dict[str, Any]) -> dict[str, Any] | None:
    intent = value.get("intent")
    reason = value.get("reason")
    question = value.get("clarificationQuestion", "")
    if intent not in {"guidance", "discovery", "clarify"} or not isinstance(reason, str) or not reason.strip():
        return None
    if intent == "clarify" and (not isinstance(question, str) or not question.strip()):
        return None
    return {"intent": intent, "reason": reason[:512], "clarificationQuestion": str(question)[:512]}


def _validate_scope(value: dict[str, Any], state: AdvisorState) -> dict[str, Any] | None:
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


def load_canonical_context(_state: AdvisorState) -> dict[str, Any]:
    # The worker supplies a fresh SpacetimeDB snapshot for every run. Checkpoint state
    # is deliberately never used as the source of catalog, selection, or UI truth.
    return {"canonical_context_loaded": True}


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
    return {"route_decision": decision}


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
    return {"branch_result": {
        "assistantContent": content[:16000],
        "directive": {"type": "discovery", "awareness": "Guidance only; your workspace selection was not changed."},
        "proposal": {"mode": "none", "offeringIds": [], "rationale": ""},
        "presentedFamilyIds": [],
        "presentedOfferingIds": [],
        "workKind": "",
    }}


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
    return {"scope_decision": decision}


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
    count = len(families)
    content = f"I found {count} course type{'s' if count != 1 else ''} in that direction. I’ve shown their focus, typical subjects, career directions, and offering counts so you can decide which type to explore."
    return {"branch_result": {
        "assistantContent": content,
        "directive": {"type": "catalog", "awareness": "Showing every relevant course type."},
        "proposal": {"mode": "none", "offeringIds": [], "rationale": ""},
        "presentedFamilyIds": family_ids,
        "presentedOfferingIds": [],
        "workKind": "area_overview",
    }}


def _load_offerings(state: AdvisorState, all_area: bool) -> dict[str, Any]:
    family_ids = _family_ids_for_scope(state)
    courses = [row for row in state.get("catalog_courses", []) if row.get("familyId") in family_ids]
    offering_ids = [str(row.get("courseId")) for row in courses]
    label = "selected course types" if all_area or len(family_ids) > 1 else "course type"
    content = f"I found {len(courses)} active university offering{'s' if len(courses) != 1 else ''} for that {label}. They’re grouped by course type in your workspace, with missing catalog facts left visibly unavailable."
    return {"branch_result": {
        "assistantContent": content,
        "directive": {"type": "catalog", "awareness": "Showing every matching active university offering."},
        "proposal": {"mode": "none", "offeringIds": [], "rationale": ""},
        "presentedFamilyIds": family_ids,
        "presentedOfferingIds": offering_ids,
        "workKind": "all_area_offerings" if all_area else "family_offerings",
    }}


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
    content = f"I’ve prepared {len(offering_ids)} exact university offering{'s' if len(offering_ids) != 1 else ''} as a provisional selection. Review the changes below the composer; confirmation remains a separate action."
    return {"branch_result": {
        "assistantContent": content,
        "directive": {"type": "catalog", "awareness": "Proposing an editable course selection."},
        "proposal": {"mode": "replace_provisional", "offeringIds": offering_ids, "rationale": str(scope.get("explanation") or "")[:4000]},
        "presentedFamilyIds": list(dict.fromkeys(str(row.get("familyId")) for row in ordered)),
        "presentedOfferingIds": offering_ids,
        "workKind": "selection_proposal",
    }}


def compare_offerings(state: AdvisorState) -> dict[str, Any]:
    scope = state.get("scope_decision", {})
    offering_ids = [str(row) for row in scope.get("offeringIds", [])][:4]
    courses = [row for offering_id in offering_ids for row in state.get("catalog_courses", []) if row.get("courseId") == offering_id]
    criterion = str(scope.get("comparisonCriterion") or "overall")
    content = f"I’ve put {len(courses)} exact university offerings side by side using {criterion}. The facts, ranking labels, and missing-data markers are deterministic; {str(scope.get('explanation') or 'I can explain the trade-offs in your context.')}"
    return {"branch_result": {
        "assistantContent": content[:16000],
        "directive": {"type": "catalog", "awareness": "Comparing exact university offerings."},
        "proposal": {"mode": "none", "offeringIds": [], "rationale": ""},
        "presentedFamilyIds": list(dict.fromkeys(str(row.get("familyId")) for row in courses)),
        "presentedOfferingIds": offering_ids,
        "workKind": "comparison",
    }}


def clarification(state: AdvisorState) -> dict[str, Any]:
    question = str(state.get("route_decision", {}).get("clarificationQuestion") or "Would you like guidance or course discovery?")
    return {"branch_result": _safe_clarification(question)}


def clarify_catalog_scope(state: AdvisorState) -> dict[str, Any]:
    question = str(state.get("scope_decision", {}).get("clarificationQuestion") or "Would you like course areas, one course type, or everything within an area?")
    return {"branch_result": _safe_clarification(question, str(state.get("scope_decision", {}).get("explanation") or "Catalog scope is unclear."))}


def _finalize(state: AdvisorState) -> dict[str, Any]:
    branch = state.get("branch_result", {})
    route = state.get("route_decision", {"intent": "clarify", "reason": "No valid route.", "clarificationQuestion": ""})
    profile = _empty_profile(state.get("profile"))
    text = _latest_human_text(state.get("messages", []))
    if route.get("intent") == "discovery" and text:
        profile["studentPhrase"] = text[:256]
        profile["courseInterests"] = profile["courseInterests"] or text[:1024]
    result = {
        "assistantContent": str(branch.get("assistantContent") or "Please tell me what you would like to explore.")[:16000],
        "route": route,
        "proposal": branch.get("proposal") or {"mode": "none", "offeringIds": [], "rationale": ""},
        "presentedFamilyIds": branch.get("presentedFamilyIds") or [],
        "presentedOfferingIds": branch.get("presentedOfferingIds") or [],
        "directive": branch.get("directive") or {"type": "discovery", "awareness": "Waiting for your choice."},
        "workItems": [],
        "workKind": str(branch.get("workKind") or ""),
        "profilePatch": profile,
    }
    if state.get("scope_decision"):
        result["scope"] = state["scope_decision"]
    return {"messages": [AIMessage(content=result["assistantContent"])], "advisor_result": result}


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
    result = {
        "assistantContent": assistant, "profilePatch": _empty_profile(state.get("profile")), "discoveryIntent": intent,
        "directive": {"type": "catalog" if mapped else "discovery", "awareness": assistant}, "workItems": [], "workKind": "",
    }
    return {"messages": [AIMessage(content=assistant)], "discovery_result": result}


def run_course_fit(state: AdvisorState) -> dict[str, Any]:
    course = state.get("course", {})
    profile = state.get("profile", {})
    phrase = str(profile.get("studentPhrase") or course.get("studentPhrase") or "your interests")
    detail = f"This {course.get('area') or 'partner'} programme at {course.get('institutionName') or 'a partner university'} is an indicative fit for someone interested in {phrase}."
    result = {
        "entityType": "course", "entityId": str(course.get("courseId") or ""), "title": str(course.get("name") or "Course match")[:256],
        "detail": detail, "institutionName": str(course.get("institutionName") or "")[:256], "area": str(course.get("area") or "")[:64],
        "country": str(course.get("country") or "")[:64], "studentPhrase": phrase[:256],
    }
    return {"messages": [AIMessage(content=detail)], "course_fit_result": result}


def route_task(state: AdvisorState) -> str:
    if state.get("task") == "course_fit":
        return "course_fit"
    version = str(state.get("graph_version") or os.getenv("ADVISOR_GRAPH_VERSION", "specialist"))
    return "legacy" if version == "legacy" else "specialist"


builder = StateGraph(AdvisorState)
builder.add_node("legacy_discover", run_discovery)
builder.add_node("course_fit", run_course_fit)
builder.add_node("load_canonical_context", load_canonical_context)
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
    "legacy": "legacy_discover", "course_fit": "course_fit", "specialist": "load_canonical_context",
})
builder.add_edge("legacy_discover", END)
builder.add_edge("course_fit", END)
builder.add_edge("load_canonical_context", "route_intent")
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

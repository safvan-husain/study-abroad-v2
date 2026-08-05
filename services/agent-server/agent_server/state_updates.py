"""Explicit graph state updates.

Every LangGraph node should return one of these helpers instead of ad-hoc dict literals.
Search for a function name (for example ``set_route_decision``) to find every writer of
that state channel in one click.

Invoke-time payloads (what the worker passes *before* START) live in
``agent_server.initial_state`` and are re-exported here for a single import surface.
"""

from __future__ import annotations

from typing import Any

from langchain_core.messages import AIMessage

from agent_server.initial_state import (
    ADVISOR_STATE_FIELD_NOTES,
    INVOKE_CASE_NOTES,
    describe_invoke_case,
    empty_course,
    empty_profile,
    empty_selection_context,
    empty_ui_context,
    initial_course_fit_state,
    initial_discover_state,
)
from agent_server.state import (
    AdvisorResult,
    AdvisorState,
    BranchResult,
    CourseFitResult,
    DiscoveryResult,
    RouteDecision,
    ScopeDecision,
    SelectionProposal,
    WorkspaceDirective,
)

# Re-export initial-state helpers so graph / tests can import from one place.
__all__ = [
    "ADVISOR_STATE_FIELD_NOTES",
    "INVOKE_CASE_NOTES",
    "PartialAdvisorState",
    "append_assistant_message",
    "build_advisor_result",
    "build_branch_area_overview",
    "build_branch_areas_overview",
    "build_branch_clarification",
    "build_branch_comparison",
    "build_branch_family_comparison",
    "build_branch_family_offerings",
    "build_branch_guidance",
    "build_branch_selection_proposal",
    "complete_advisor_turn",
    "complete_course_fit_turn",
    "complete_discovery_turn",
    "describe_invoke_case",
    "empty_course",
    "empty_profile",
    "empty_selection_context",
    "empty_ui_context",
    "initial_course_fit_state",
    "initial_discover_state",
    "set_advisor_result",
    "set_branch_result",
    "set_route_decision",
    "set_scope_decision",
]


PartialAdvisorState = dict[str, Any]


def _empty_proposal() -> SelectionProposal:
    return {"mode": "none", "offeringIds": [], "rationale": ""}


def _discovery_directive(awareness: str = "Waiting for your choice.") -> WorkspaceDirective:
    return {"type": "discovery", "awareness": awareness}


def _catalog_directive(awareness: str) -> WorkspaceDirective:
    return {"type": "catalog", "awareness": awareness}


# --- Top-level state setters -------------------------------------------------


def set_route_decision(decision: RouteDecision) -> PartialAdvisorState:
    return {"route_decision": decision}


def set_scope_decision(decision: ScopeDecision) -> PartialAdvisorState:
    return {"scope_decision": decision}


def set_branch_result(result: BranchResult) -> PartialAdvisorState:
    return {"branch_result": result}


def set_advisor_result(result: AdvisorResult) -> PartialAdvisorState:
    return {"advisor_result": result}


def append_assistant_message(content: str) -> PartialAdvisorState:
    return {"messages": [AIMessage(content=content)]}


def complete_advisor_turn(result: AdvisorResult) -> PartialAdvisorState:
    return {
        "messages": [AIMessage(content=result["assistantContent"])],
        "advisor_result": result,
    }


def complete_discovery_turn(result: DiscoveryResult) -> PartialAdvisorState:
    return {
        "messages": [AIMessage(content=result["assistantContent"])],
        "discovery_result": result,
    }


def complete_course_fit_turn(result: CourseFitResult) -> PartialAdvisorState:
    return {
        "messages": [AIMessage(content=result["detail"])],
        "course_fit_result": result,
    }


# --- Branch result builders --------------------------------------------------


def build_branch_clarification(question: str) -> BranchResult:
    return {
        "assistantContent": question,
        "directive": _discovery_directive(),
        "proposal": _empty_proposal(),
        "presentedFamilyIds": [],
        "presentedOfferingIds": [],
        "workKind": "",
    }


def build_branch_guidance(content: str) -> BranchResult:
    return {
        "assistantContent": content[:16000],
        "directive": _discovery_directive("Guidance only; your workspace selection was not changed."),
        "proposal": _empty_proposal(),
        "presentedFamilyIds": [],
        "presentedOfferingIds": [],
        "workKind": "",
    }


def build_branch_areas_overview(area_count: int) -> BranchResult:
    content = (
        f"I’ve opened the {area_count} main course area{'s' if area_count != 1 else ''} in your workspace — "
        "fields like Computing, Health, Business, Engineering, and Society. "
        "Tell me which one you want to explore and I’ll show the course types inside it."
    )
    return {
        "assistantContent": content,
        "directive": _catalog_directive("Showing the main course areas."),
        "proposal": _empty_proposal(),
        "presentedFamilyIds": [],
        "presentedOfferingIds": [],
        "workKind": "areas_overview",
    }


def build_branch_area_overview(family_ids: list[str], family_count: int) -> BranchResult:
    content = (
        f"I found {family_count} course type{'s' if family_count != 1 else ''} in that direction. "
        "I’ve shown their focus, typical subjects, career directions, and offering counts so you can decide which type to explore."
    )
    return {
        "assistantContent": content,
        "directive": _catalog_directive("Showing every relevant course type."),
        "proposal": _empty_proposal(),
        "presentedFamilyIds": family_ids,
        "presentedOfferingIds": [],
        "workKind": "area_overview",
    }


def build_branch_family_offerings(
    family_ids: list[str],
    offering_ids: list[str],
    course_count: int,
    *,
    all_area: bool,
) -> BranchResult:
    label = "selected course types" if all_area or len(family_ids) > 1 else "course type"
    content = (
        f"I found {course_count} active university offering{'s' if course_count != 1 else ''} for that {label}. "
        "They’re grouped by course type in your workspace, with missing catalog facts left visibly unavailable."
    )
    return {
        "assistantContent": content,
        "directive": _catalog_directive("Showing every matching active university offering."),
        "proposal": _empty_proposal(),
        "presentedFamilyIds": family_ids,
        "presentedOfferingIds": offering_ids,
        "workKind": "all_area_offerings" if all_area else "family_offerings",
    }


def build_branch_selection_proposal(
    offering_ids: list[str],
    family_ids: list[str],
    rationale: str,
) -> BranchResult:
    count = len(offering_ids)
    content = (
        f"I’ve prepared {count} exact university offering{'s' if count != 1 else ''} as a provisional selection. "
        "Review the changes below the composer; confirmation remains a separate action."
    )
    return {
        "assistantContent": content,
        "directive": _catalog_directive("Proposing an editable course selection."),
        "proposal": {"mode": "replace_provisional", "offeringIds": offering_ids, "rationale": rationale[:4000]},
        "presentedFamilyIds": family_ids,
        "presentedOfferingIds": offering_ids,
        "workKind": "selection_proposal",
    }


def build_branch_comparison(
    offering_ids: list[str],
    family_ids: list[str],
    course_count: int,
    criterion: str,
    explanation: str,
) -> BranchResult:
    content = (
        f"I’ve put {course_count} exact university offerings side by side using {criterion}. "
        f"The facts, ranking labels, and missing-data markers are deterministic; {explanation}"
    )
    return {
        "assistantContent": content[:16000],
        "directive": _catalog_directive("Comparing exact university offerings."),
        "proposal": _empty_proposal(),
        "presentedFamilyIds": family_ids,
        "presentedOfferingIds": offering_ids,
        "workKind": "comparison",
    }


def build_branch_family_comparison(
    family_ids: list[str],
    content: str,
) -> BranchResult:
    return {
        "assistantContent": content[:16000],
        "directive": _discovery_directive("Comparing selected course types in chat."),
        "proposal": _empty_proposal(),
        "presentedFamilyIds": family_ids,
        "presentedOfferingIds": [],
        "workKind": "",
    }


# --- Turn finalization -------------------------------------------------------


def build_advisor_result(state: AdvisorState, *, latest_human_text: str = "") -> AdvisorResult:
    branch = state.get("branch_result", {})
    route = state.get("route_decision") or {
        "intent": "clarify",
        "reason": "No valid route.",
        "clarificationQuestion": "",
    }
    profile = empty_profile(state.get("profile"))
    if route.get("intent") == "discovery" and latest_human_text:
        profile["studentPhrase"] = latest_human_text[:256]
        profile["courseInterests"] = profile["courseInterests"] or latest_human_text[:1024]
    result: AdvisorResult = {
        "assistantContent": str(branch.get("assistantContent") or "Please tell me what you would like to explore.")[:16000],
        "route": route,
        "proposal": branch.get("proposal") or _empty_proposal(),
        "presentedFamilyIds": branch.get("presentedFamilyIds") or [],
        "presentedOfferingIds": branch.get("presentedOfferingIds") or [],
        "directive": branch.get("directive") or _discovery_directive(),
        "workItems": [],
        "workKind": str(branch.get("workKind") or ""),
        "profilePatch": profile,
    }
    if state.get("scope_decision"):
        result["scope"] = state["scope_decision"]
    return result

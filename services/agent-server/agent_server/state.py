from __future__ import annotations

from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class RouteDecision(TypedDict):
    intent: Literal["guidance", "discovery", "clarify"]
    reason: str
    clarificationQuestion: str


class ScopeDecision(TypedDict):
    scope: Literal[
        "areas_overview",
        "area_overview",
        "family_offerings",
        "all_area_offerings",
        "compare_offerings",
        "personalize_selection",
        "clarify",
    ]
    areaId: str
    familyIds: list[str]
    offeringIds: list[str]
    explanation: str
    clarificationQuestion: str
    comparisonCriterion: str


class WorkspaceDirective(TypedDict):
    type: str
    awareness: str


class SelectionProposal(TypedDict):
    mode: str
    offeringIds: list[str]
    rationale: str


class BranchResult(TypedDict):
    assistantContent: str
    directive: WorkspaceDirective
    proposal: SelectionProposal
    presentedFamilyIds: list[str]
    presentedOfferingIds: list[str]
    workKind: str


class AdvisorResult(TypedDict, total=False):
    assistantContent: str
    route: RouteDecision
    scope: ScopeDecision
    proposal: SelectionProposal
    presentedFamilyIds: list[str]
    presentedOfferingIds: list[str]
    directive: WorkspaceDirective
    workItems: list[Any]
    workKind: str
    profilePatch: dict[str, Any]


class DiscoveryResult(TypedDict):
    assistantContent: str
    profilePatch: dict[str, Any]
    discoveryIntent: dict[str, Any]
    directive: WorkspaceDirective
    workItems: list[Any]
    workKind: str


class CourseFitResult(TypedDict):
    entityType: str
    entityId: str
    title: str
    detail: str
    institutionName: str
    area: str
    country: str
    studentPhrase: str


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
    route_decision: RouteDecision
    scope_decision: ScopeDecision
    branch_result: BranchResult
    advisor_result: AdvisorResult
    discovery_result: DiscoveryResult
    course_fit_result: CourseFitResult

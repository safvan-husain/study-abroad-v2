"""Documented initial ``AdvisorState`` payloads for each graph invoke.

LangGraph does **not** invent the starting state. The AI worker (or a test) passes
an input dict into ``runs.wait`` / ``graph.invoke``. ``route_task`` reads
``task`` from that input *before any node runs*.

Invoke cases
------------
``discover``
    Parent chat turn. Full SpacetimeDB catalog + selection snapshot. Routes to
    specialist (or legacy) discovery / guidance.

``course_fit``
    Child work-item turn. One course + profile phrase. Routes straight to
    ``course_fit`` → END. Separate thread per course.

Notes below are meant to be read next to the builders — they describe *why* each
channel is present, not just its type.
"""

from __future__ import annotations

from typing import Any, TypedDict

from agent_server.state import AdvisorState


# --- Field-level notes (shared vocabulary) -----------------------------------

ADVISOR_STATE_FIELD_NOTES: dict[str, str] = {
    "messages": (
        "Latest human turn for discover; usually empty for course_fit "
        "(fit text is built from course + profile, not chat)."
    ),
    "task": (
        "Top-level router key read by route_task at START. "
        "'discover' → specialist/legacy; 'course_fit' → course_fit node."
    ),
    "graph_version": (
        "When task is not course_fit: 'specialist' (default) or 'legacy'. "
        "Usually supplied from ADVISOR_GRAPH_VERSION on the worker."
    ),
    "catalog_areas": "Optional/legacy. Prefer process catalog index area ids.",
    "catalog_families": "Optional/legacy. Full catalog lives in agent_server.catalog_index.",
    "catalog_courses": "Optional/legacy. Full catalog lives in agent_server.catalog_index.",
    "profile": "Student profile patch shape — see empty_profile(). Canonical truth from worker.",
    "ui_context": "Current UI focus (view, selected ids). Resolves pronouns like 'these'.",
    "selection_context": (
        "presentedFamilyIds / selectedFamilyIds / presentedOfferingIds / provisional / suppressed. "
        "Authoritative over checkpoint for 'show all these' and course-type comparison overrides."
    ),
    "course": "Single offering payload for course_fit child runs. Empty {} on discover.",
    "route_decision": "Written by route_intent. Absent at invoke.",
    "scope_decision": "Written by resolve_catalog_scope. Absent at invoke.",
    "branch_result": "Written by leaf specialist nodes. Absent at invoke.",
    "advisor_result": "Written by validate_* / _finalize. Absent at invoke.",
    "discovery_result": "Written by legacy run_discovery. Absent at invoke.",
    "course_fit_result": "Written by run_course_fit. Absent at invoke.",
}


class InvokeCaseNotes(TypedDict):
    """Human-readable description of one worker → graph invoke shape."""

    task: str
    who_calls: str
    route: str
    purpose: str
    required_channels: list[str]
    unused_or_empty: list[str]
    notes: list[str]


# Case catalog — keep in sync with agent-server-client.ts run() / runCourseFit().
INVOKE_CASE_NOTES: dict[str, InvokeCaseNotes] = {
    "discover": {  # → initial_discover_state()
        "task": "discover",
        "who_calls": "AgentClient.run (parent chat turn)",
        "route": "START → route_task → route_intent (specialist) or legacy_discover",
        "purpose": (
            "Classify the student message and either answer guidance, resolve catalog "
            "scope, or clarify — then finalize advisor_result for the worker."
        ),
        "required_channels": [
            "messages",
            "task",
            "graph_version",
            "profile",
            "ui_context",
            "selection_context",
        ],
        "unused_or_empty": [
            "course (always {})",
            "catalog_areas / catalog_families / catalog_courses (empty — process index owns catalog)",
            "route_decision / scope_decision / branch_result (filled during the run)",
        ],
        "notes": [
            "Catalog tools read agent_server.catalog_index (seeded at agent-server startup).",
            "Worker injects profile/ui/selection every turn — checkpoint is not selection truth.",
            "Only the latest human message is sent (messages.slice(-1)).",
            "selection_context.revision is stringified for JSON transport.",
        ],
    },
    "course_fit": {  # → initial_course_fit_state()
        "task": "course_fit",
        "who_calls": "AgentClient.runCourseFit ← processWorkItem(kind=course_fit_summary)",
        "route": "START → route_task → course_fit → END",
        "purpose": (
            "Produce one indicative per-course summary for a child work item. "
            "Does not browse catalog or mutate selection."
        ),
        "required_channels": [
            "task",
            "profile",
            "ui_context",
            "course",
        ],
        "unused_or_empty": [
            "messages ([])",
            "catalog_areas / catalog_families / catalog_courses (omitted — process index)",
            "selection_context (omitted)",
            "graph_version (ignored when task is course_fit)",
        ],
        "notes": [
            "Separate LangGraph thread per (conversationId, courseId).",
            "course.studentPhrase falls back to profile.studentPhrase.",
            "Parent discover turn may have created many of these work items; each is an independent invoke.",
        ],
    },
}


# --- Empty / clamped primitives ----------------------------------------------


def empty_profile(existing: dict[str, Any] | None = None) -> dict[str, Any]:
    """Clamp profile fields to the contract lengths used across the graph."""
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


def empty_ui_context() -> dict[str, Any]:
    return {}


def empty_selection_context() -> dict[str, Any]:
    return {
        "presentedFamilyIds": [],
        "selectedFamilyIds": [],
        "presentedOfferingIds": [],
        "provisionalOfferingIds": [],
        "suppressedOfferingIds": [],
    }


def empty_course() -> dict[str, Any]:
    return {}


# --- Invoke builders ---------------------------------------------------------


def initial_discover_state(
    *,
    messages: list[Any],
    catalog_areas: list[str] | None = None,
    catalog_families: list[dict[str, Any]] | None = None,
    catalog_courses: list[dict[str, Any]] | None = None,
    profile: dict[str, Any] | None = None,
    ui_context: dict[str, Any] | None = None,
    selection_context: dict[str, Any] | None = None,
    graph_version: str = "specialist",
) -> AdvisorState:
    """Parent chat-turn input (``task='discover'``).

    Mirrors ``AgentClient.run`` in the AI worker.

    Understanding this case::

        INVOKE_CASE_NOTES["discover"]
            task: discover
            who_calls: AgentClient.run (parent chat turn)
            route: START → specialist | legacy
            required: messages, catalog_*, profile, ui_context, selection_context
            course: always {}
    """
    return {
        "messages": messages,
        "task": "discover",
        "graph_version": graph_version,
        "catalog_areas": list(catalog_areas or []),
        "catalog_families": list(catalog_families or []),
        "catalog_courses": list(catalog_courses or []),
        "profile": empty_profile(profile),
        "ui_context": dict(ui_context or empty_ui_context()),
        "selection_context": dict(selection_context or empty_selection_context()),
        "course": empty_course(),
    }


def initial_course_fit_state(
    *,
    course: dict[str, Any],
    profile: dict[str, Any] | None = None,
    ui_context: dict[str, Any] | None = None,
) -> AdvisorState:
    """Child work-item input (``task='course_fit'``).

    Mirrors ``AgentClient.runCourseFit``.

    Understanding this case::

        INVOKE_CASE_NOTES["course_fit"]
            task: course_fit
            who_calls: processWorkItem → runCourseFit
            route: START → course_fit → END
            required: task, profile, ui_context, course
            messages / catalog: empty or omitted
    """
    profile_patch = empty_profile(profile)
    course_payload = dict(course)
    if not course_payload.get("studentPhrase"):
        course_payload["studentPhrase"] = profile_patch.get("studentPhrase") or ""
    return {
        "messages": [],
        "task": "course_fit",
        "catalog_areas": [],
        "profile": profile_patch,
        "ui_context": dict(ui_context or empty_ui_context()),
        "course": course_payload,
    }


def describe_invoke_case(task: str) -> str:
    """Pretty multi-line notes for a task value (handy in logs / explorers)."""
    case = INVOKE_CASE_NOTES.get(task)
    if case is None:
        return f"Unknown task {task!r}. Known: {', '.join(INVOKE_CASE_NOTES)}."
    lines = [
        f"task: {case['task']}",
        f"who_calls: {case['who_calls']}",
        f"route: {case['route']}",
        f"purpose: {case['purpose']}",
        "required_channels:",
        *[f"  - {row}" for row in case["required_channels"]],
        "unused_or_empty:",
        *[f"  - {row}" for row in case["unused_or_empty"]],
        "notes:",
        *[f"  - {row}" for row in case["notes"]],
    ]
    return "\n".join(lines)

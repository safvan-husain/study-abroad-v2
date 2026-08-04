from agent_server.initial_state import (
    INVOKE_CASE_NOTES,
    describe_invoke_case,
    empty_profile,
    initial_course_fit_state,
    initial_discover_state,
)
from agent_server.state_updates import empty_profile as reexported_empty_profile


def test_empty_profile_clamps_and_defaults():
    profile = empty_profile({"studentPhrase": "x" * 400, "candidateAreas": list("abcdefghijk")})
    assert len(profile["studentPhrase"]) == 256
    assert len(profile["candidateAreas"]) == 8
    assert profile["background"] == ""


def test_empty_profile_reexported_from_state_updates():
    assert reexported_empty_profile is empty_profile


def test_initial_discover_state_sets_router_key():
    state = initial_discover_state(messages=[{"role": "human", "content": "hi"}])
    assert state["task"] == "discover"
    assert state["course"] == {}
    assert state["graph_version"] == "specialist"
    assert "catalog_families" in state


def test_initial_course_fit_state_sets_router_key_and_phrase_fallback():
    state = initial_course_fit_state(
        course={"courseId": "c1", "name": "CS"},
        profile={"studentPhrase": "computing"},
    )
    assert state["task"] == "course_fit"
    assert state["messages"] == []
    assert state["course"]["studentPhrase"] == "computing"


def test_invoke_case_notes_cover_both_worker_paths():
    assert set(INVOKE_CASE_NOTES) == {"discover", "course_fit"}
    text = describe_invoke_case("course_fit")
    assert "task: course_fit" in text
    assert "route:" in text

from langchain_core.messages import HumanMessage

from agent_server.graph import _map_phrase, _ollama_chat, _validate_scope, graph, run_course_fit, run_discovery
from agent_server.initial_state import initial_course_fit_state, initial_discover_state
from tests.catalog_fixtures import COURSES, FAMILIES, COMPUTING_AREA_ID


INTEREST_MESSAGE = "Hi, I like to learn computer programming or computer science."


def invoke_specialist(monkeypatch, message, scope_decision, selection=None):
    def fake_json(system, payload, model, validate):
        raw = {"intent": "discovery", "reason": "Course exploration", "clarificationQuestion": ""} if "Classify" in system else scope_decision
        return validate(raw)
    monkeypatch.setattr("agent_server.graph._ollama_json", fake_json)
    return graph.invoke(initial_discover_state(
        messages=[HumanMessage(content=message)],
        catalog_families=FAMILIES,
        catalog_courses=COURSES,
        selection_context=selection or {},
    ))["advisor_result"]


def test_ollama_can_be_disabled(monkeypatch):
    monkeypatch.setenv("OLLAMA_HOST", "https://ollama.example")
    monkeypatch.setenv("OLLAMA_DISABLED", "true")
    assert _ollama_chat("system", "human") is None


def test_ollama_boundary_is_non_streaming_and_time_bounded(monkeypatch):
    import httpx

    captured = {}

    class Response:
        def raise_for_status(self): pass
        def json(self): return {"message": {"content": "safe response"}}

    def fake_post(url, **kwargs):
        captured.update({"url": url, **kwargs})
        return Response()

    monkeypatch.setenv("OLLAMA_HOST", "https://ollama.example")
    monkeypatch.setenv("OLLAMA_TIMEOUT_SECONDS", "12")
    monkeypatch.delenv("OLLAMA_DISABLED", raising=False)
    monkeypatch.setattr(httpx, "post", fake_post)
    assert _ollama_chat("system", "human", "model-a") == "safe response"
    assert captured["url"] == "https://ollama.example/api/chat"
    assert captured["json"]["stream"] is False
    assert captured["timeout"] == 12


def test_maps_programming_to_computing():
    intent = _map_phrase("I like programming and software", ["computing", "business", "engineering"])
    assert intent["status"] == "mapped"
    assert "computing" in intent["catalogAreas"]
    assert intent["studentPhrase"] in {"programming", "software", "I like programming and software"}


def test_keeps_unmapped_phrase_without_inventing_areas():
    intent = _map_phrase("underwater basket weaving", ["computing", "business"])
    assert intent["status"] == "unmapped"
    assert intent["catalogAreas"] == []
    assert "underwater basket weaving" in intent["studentPhrase"]


def test_discovery_returns_catalog_directive_for_mapped_interest():
    result = run_discovery(
        {
            "messages": [HumanMessage(content="I am interested in programming")],
            "catalog_areas": ["computing", "business"],
            "profile": {},
            "task": "discover",
            "course": {},
            "discovery_result": {},
            "course_fit_result": {},
        }
    )
    discovery = result["discovery_result"]
    assert discovery["discoveryIntent"]["status"] == "mapped"
    assert discovery["directive"]["type"] == "catalog"
    assert "programming" in discovery["directive"]["awareness"]


def test_course_fit_stays_indicative():
    result = run_course_fit(
        initial_course_fit_state(
            profile={"studentPhrase": "programming"},
            course={
                "courseId": "lu-computer-science-bsc",
                "name": "Computer Science",
                "institutionName": "University of Latvia",
                "area": "computing",
                "country": "Latvia",
            },
        )
    )
    fit = result["course_fit_result"]
    assert fit["entityId"] == "lu-computer-science-bsc"
    assert "programming" in fit["detail"].lower()


def test_rejects_guarantee_claims_in_model_fit_text():
    from agent_server.graph import _is_indicative_fit_text

    assert _is_indicative_fit_text("This course may suit programming interests.")
    assert not _is_indicative_fit_text("This course guarantees admission and visa approval.")


def test_interest_statement_explains_every_nearby_course_type_without_shortlisting(monkeypatch):
    result = invoke_specialist(monkeypatch, "I want computer science", {
        "scope": "area_overview", "areaId": COMPUTING_AREA_ID, "familyIds": ["computer-science"], "offeringIds": [],
        "explanation": "Explain nearby types first", "clarificationQuestion": "", "comparisonCriterion": "",
    })
    assert result["presentedFamilyIds"] == [row["familyId"] for row in FAMILIES]
    assert result["proposal"]["mode"] == "none"


def test_programming_interest_statement_uses_area_overview_when_routed_as_discovery(monkeypatch):
    """Deterministic regression for the exact mis-routed message; live check in test_graph_live.py."""
    result = invoke_specialist(monkeypatch, INTEREST_MESSAGE, {
        "scope": "area_overview", "areaId": COMPUTING_AREA_ID, "familyIds": ["computer-science"], "offeringIds": [],
        "explanation": "Broad computing interest", "clarificationQuestion": "", "comparisonCriterion": "",
    })
    assert result["route"]["intent"] == "discovery"
    assert result["scope"]["scope"] == "area_overview"
    assert result["presentedFamilyIds"] == [row["familyId"] for row in FAMILIES]
    assert result["directive"]["type"] == "catalog"
    assert result["proposal"]["mode"] == "none"


def test_explicit_family_command_loads_every_exact_offering(monkeypatch):
    result = invoke_specialist(monkeypatch, "Show Computer Science courses", {
        "scope": "family_offerings", "areaId": COMPUTING_AREA_ID, "familyIds": ["computer-science"], "offeringIds": [],
        "explanation": "Explicit display command", "clarificationQuestion": "", "comparisonCriterion": "",
    })
    assert result["presentedOfferingIds"] == ["cs-lu", "cs-charles"]
    assert result["proposal"]["mode"] == "none"


def test_show_all_uses_previously_presented_families_without_a_limit(monkeypatch):
    result = invoke_specialist(monkeypatch, "Show all these", {
        "scope": "all_area_offerings", "areaId": "", "familyIds": [row["familyId"] for row in FAMILIES], "offeringIds": [],
        "explanation": "Use presented families", "clarificationQuestion": "", "comparisonCriterion": "",
    }, {"presentedFamilyIds": [row["familyId"] for row in FAMILIES]})
    assert result["presentedOfferingIds"] == [row["courseId"] for row in COURSES]


def test_show_all_resolves_presented_families_even_when_model_asks_to_clarify(monkeypatch):
    result = invoke_specialist(monkeypatch, "Show all these", {
        "scope": "clarify", "areaId": "", "familyIds": [], "offeringIds": [],
        "explanation": "Reference appeared ambiguous", "clarificationQuestion": "Which items?", "comparisonCriterion": "",
    }, {"presentedFamilyIds": [row["familyId"] for row in FAMILIES]})
    assert result["presentedOfferingIds"] == [row["courseId"] for row in COURSES]
    assert result["scope"]["scope"] == "all_area_offerings"


def test_negative_coding_preference_does_not_map_to_computing(monkeypatch):
    result = invoke_specialist(monkeypatch, "I dislike coding", {
        "scope": "clarify", "areaId": "", "familyIds": [], "offeringIds": [],
        "explanation": "Negative preference", "clarificationQuestion": "What subjects do you enjoy instead?", "comparisonCriterion": "",
    })
    assert result["proposal"]["offeringIds"] == []
    assert result["presentedFamilyIds"] == []


def test_recommendation_creates_exact_provisional_ids_and_comparison_does_not(monkeypatch):
    recommendation = invoke_specialist(monkeypatch, "Recommend two", {
        "scope": "personalize_selection", "areaId": "", "familyIds": [], "offeringIds": ["cs-lu", "cs-charles"],
        "explanation": "Exact profile-based proposal", "clarificationQuestion": "", "comparisonCriterion": "",
    })
    assert recommendation["proposal"] == {"mode": "replace_provisional", "offeringIds": ["cs-lu", "cs-charles"], "rationale": "Exact profile-based proposal"}
    comparison = invoke_specialist(monkeypatch, "Compare the two", {
        "scope": "compare_offerings", "areaId": "", "familyIds": [], "offeringIds": ["cs-lu", "cs-charles"],
        "explanation": "One has no verified ranking", "clarificationQuestion": "", "comparisonCriterion": "ranking",
    })
    assert comparison["proposal"]["mode"] == "none"
    assert comparison["scope"]["comparisonCriterion"] == "ranking"


def test_comparison_requires_an_explicit_or_overall_criterion():
    state = {"catalog_families": FAMILIES, "catalog_courses": COURSES, "messages": [HumanMessage(content="Compare the two courses")]}
    decision = {
        "scope": "compare_offerings", "areaId": "", "familyIds": [], "offeringIds": ["cs-lu", "cs-charles"],
        "explanation": "Compare the exact offerings", "clarificationQuestion": "", "comparisonCriterion": "",
    }
    assert _validate_scope(decision, state) is None
    decision["comparisonCriterion"] = "overall"
    assert _validate_scope(decision, state)["comparisonCriterion"] == "overall"


def test_prior_comparison_cannot_override_a_new_interest_statement():
    state = {"catalog_families": FAMILIES, "catalog_courses": COURSES, "messages": [HumanMessage(content="I want computer science")]}
    decision = {
        "scope": "compare_offerings", "areaId": "", "familyIds": [], "offeringIds": ["cs-lu", "cs-charles"],
        "explanation": "Continue the prior comparison", "clarificationQuestion": "", "comparisonCriterion": "ranking",
    }
    assert _validate_scope(decision, state) is None

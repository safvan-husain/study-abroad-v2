from langchain_core.messages import HumanMessage

from agent_server.graph import _map_phrase, run_course_fit, run_discovery


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
        {
            "messages": [],
            "catalog_areas": [],
            "profile": {"studentPhrase": "programming"},
            "task": "course_fit",
            "course": {
                "courseId": "lu-computer-science-bsc",
                "name": "Computer Science",
                "institutionName": "University of Latvia",
                "area": "computing",
                "country": "Latvia",
            },
            "discovery_result": {},
            "course_fit_result": {},
        }
    )
    fit = result["course_fit_result"]
    assert fit["entityId"] == "lu-computer-science-bsc"
    assert "programming" in fit["detail"].lower()


def test_rejects_guarantee_claims_in_model_fit_text():
    from agent_server.graph import _is_indicative_fit_text

    assert _is_indicative_fit_text("This course may suit programming interests.")
    assert not _is_indicative_fit_text("This course guarantees admission and visa approval.")

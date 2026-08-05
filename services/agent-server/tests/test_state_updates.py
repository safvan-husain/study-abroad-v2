from agent_server.state_updates import (
    build_branch_area_overview,
    build_branch_areas_overview,
    build_branch_family_comparison,
    complete_advisor_turn,
    set_route_decision,
    set_scope_decision,
)


def test_set_route_decision_is_the_only_writer_of_route_decision():
    update = set_route_decision({
        "intent": "discovery",
        "reason": "Course exploration",
        "clarificationQuestion": "",
    })
    assert set(update) == {"route_decision"}
    assert update["route_decision"]["intent"] == "discovery"


def test_set_scope_decision_is_the_only_writer_of_scope_decision():
    update = set_scope_decision({
        "scope": "area_overview",
        "areaId": "computing-technology",
        "familyIds": [],
        "offeringIds": [],
        "explanation": "Explain nearby types",
        "clarificationQuestion": "",
        "comparisonCriterion": "",
    })
    assert set(update) == {"scope_decision"}
    assert update["scope_decision"]["scope"] == "area_overview"


def test_complete_advisor_turn_writes_messages_and_advisor_result():
    update = complete_advisor_turn({
        "assistantContent": "Hello",
        "route": {"intent": "guidance", "reason": "General help", "clarificationQuestion": ""},
        "proposal": {"mode": "none", "offeringIds": [], "rationale": ""},
        "presentedFamilyIds": [],
        "presentedOfferingIds": [],
        "directive": {"type": "discovery", "awareness": "Guidance only"},
        "workItems": [],
        "workKind": "",
        "profilePatch": {},
    })
    assert set(update) == {"messages", "advisor_result"}
    assert update["advisor_result"]["assistantContent"] == "Hello"
    assert len(update["messages"]) == 1


def test_branch_builders_do_not_touch_graph_state():
    branch = build_branch_area_overview(["computer-science"], 1)
    assert branch["workKind"] == "area_overview"
    assert branch["presentedFamilyIds"] == ["computer-science"]
    areas = build_branch_areas_overview(5)
    assert areas["workKind"] == "areas_overview"
    assert areas["presentedFamilyIds"] == []
    assert areas["directive"]["type"] == "catalog"
    family_compare = build_branch_family_comparison(
        ["computer-science", "data-science"],
        "Computer Science focuses on algorithms; Data Science focuses on analysis.",
    )
    assert family_compare["workKind"] == ""
    assert family_compare["directive"]["type"] == "discovery"
    assert family_compare["presentedFamilyIds"] == ["computer-science", "data-science"]
    assert family_compare["presentedOfferingIds"] == []
    assert "algorithms" in family_compare["assistantContent"]

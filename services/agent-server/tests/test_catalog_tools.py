from agent_server.catalog_index import load_fixture
from agent_server.catalog_tools import (
    dispatch_catalog_tool,
    find_institution,
    get_course,
    list_areas,
    list_courses,
    list_families_for_area,
    map_interest_to_area,
)
from tests.catalog_fixtures import COMPUTING_AREA_ID, COMPUTING_FAMILIES, COURSES, FAMILIES, HEALTH_AREA_ID


def test_map_interest_to_computing_area():
    load_fixture(families=FAMILIES, courses=COURSES)
    mapped = map_interest_to_area("I like computer programming")
    assert mapped["areaId"] == COMPUTING_AREA_ID
    assert mapped["confidence"] in {"high", "medium"}


def test_list_areas_returns_catalog_fields():
    load_fixture(families=FAMILIES, courses=COURSES)
    listed = list_areas()
    assert listed["count"] == 2
    area_ids = {row["areaId"] for row in listed["areas"]}
    assert area_ids == {COMPUTING_AREA_ID, HEALTH_AREA_ID}
    computing = next(row for row in listed["areas"] if row["areaId"] == COMPUTING_AREA_ID)
    assert computing["name"] == "Computing and Technology"
    assert computing["familyCount"] == len(COMPUTING_FAMILIES)


def test_list_families_and_courses_for_area():
    load_fixture(families=FAMILIES, courses=COURSES)
    families = list_families_for_area(COMPUTING_AREA_ID)
    assert families["count"] == len(COMPUTING_FAMILIES)
    assert {row["familyId"] for row in families["families"]} == {row["familyId"] for row in COMPUTING_FAMILIES}
    offerings = list_courses(family_id="computer-science")
    assert offerings["count"] == 2
    assert {row["courseId"] for row in offerings["offerings"]} == {"cs-lu", "cs-charles"}


def test_find_institution_and_get_course():
    load_fixture(families=FAMILIES, courses=COURSES)
    found = find_institution("University of Latvia")
    assert found["count"] >= 1
    assert found["institutions"][0]["institutionId"] == "university-of-latvia"
    course = get_course("cs-lu")
    assert course["found"] is True
    assert course["course"]["name"] == "Computer Science"


def test_dispatch_unknown_tool():
    result = dispatch_catalog_tool("nope", {})
    assert "error" in result

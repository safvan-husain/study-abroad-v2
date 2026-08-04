"""Deterministic catalog retrieval tools over the process-level index."""

from __future__ import annotations

from typing import Any, Callable

from agent_server.catalog_index import get_catalog_index


TOOL_SPECS: list[dict[str, str]] = [
    {
        "name": "list_areas",
        "description": "List all top-level catalog course areas (fields of study) with family counts.",
    },
    {
        "name": "map_interest_to_area",
        "description": "Map a free-text interest phrase to a catalog areaId (broader category).",
    },
    {
        "name": "list_families_for_area",
        "description": "List distinct course types (families) in an area.",
    },
    {
        "name": "list_courses",
        "description": "List compact offerings filtered by familyId, areaId, institutionId, and/or country.",
    },
    {
        "name": "find_institution",
        "description": "Find institutions by name or alias fragment.",
    },
    {
        "name": "get_course",
        "description": "Fetch one offering by courseId (for UI-focused references).",
    },
]


def list_areas() -> dict[str, Any]:
    areas = get_catalog_index().list_areas()
    return {"areas": areas, "count": len(areas)}


def map_interest_to_area(phrase: str) -> dict[str, Any]:
    return get_catalog_index().map_interest_to_area(phrase)


def list_families_for_area(area_id: str) -> dict[str, Any]:
    index = get_catalog_index()
    area = str(area_id or "")
    families = [index.compact_family(row) for row in index.families_for_area(area)]
    return {"areaId": area, "families": families, "count": len(families)}


def list_courses(
    *,
    family_id: str = "",
    area_id: str = "",
    institution_id: str = "",
    country: str = "",
    limit: int = 50,
) -> dict[str, Any]:
    offerings = get_catalog_index().list_courses(
        family_id=str(family_id or ""),
        area_id=str(area_id or ""),
        institution_id=str(institution_id or ""),
        country=str(country or ""),
        limit=limit,
    )
    return {
        "familyId": str(family_id or ""),
        "areaId": str(area_id or ""),
        "institutionId": str(institution_id or ""),
        "country": str(country or ""),
        "offerings": offerings,
        "count": len(offerings),
    }


def find_institution(query: str, *, limit: int = 8) -> dict[str, Any]:
    institutions = get_catalog_index().find_institution(str(query or ""), limit=limit)
    return {"query": str(query or ""), "institutions": institutions, "count": len(institutions)}


def get_course(course_id: str) -> dict[str, Any]:
    index = get_catalog_index()
    row = index.get_course(str(course_id or ""))
    if row is None:
        return {"courseId": str(course_id or ""), "found": False, "course": None}
    return {"courseId": str(course_id or ""), "found": True, "course": index.compact_course(row)}


_DISPATCH: dict[str, Callable[..., dict[str, Any]]] = {
    "list_areas": lambda **kwargs: list_areas(),
    "map_interest_to_area": lambda **kwargs: map_interest_to_area(str(kwargs.get("phrase") or kwargs.get("query") or "")),
    "list_families_for_area": lambda **kwargs: list_families_for_area(str(kwargs.get("areaId") or kwargs.get("area_id") or "")),
    "list_courses": lambda **kwargs: list_courses(
        family_id=str(kwargs.get("familyId") or kwargs.get("family_id") or ""),
        area_id=str(kwargs.get("areaId") or kwargs.get("area_id") or ""),
        institution_id=str(kwargs.get("institutionId") or kwargs.get("institution_id") or ""),
        country=str(kwargs.get("country") or ""),
        limit=int(kwargs.get("limit") or 50),
    ),
    "find_institution": lambda **kwargs: find_institution(
        str(kwargs.get("query") or kwargs.get("name") or ""),
        limit=int(kwargs.get("limit") or 8),
    ),
    "get_course": lambda **kwargs: get_course(str(kwargs.get("courseId") or kwargs.get("course_id") or "")),
}


def dispatch_catalog_tool(name: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    handler = _DISPATCH.get(str(name or ""))
    if handler is None:
        return {"error": f"unknown tool: {name}", "tools": [row["name"] for row in TOOL_SPECS]}
    try:
        return handler(**dict(args or {}))
    except (TypeError, ValueError) as exc:
        return {"error": str(exc), "tool": name}

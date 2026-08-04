"""Process-level catalog index for discovery tools.

Loaded once at agent-server startup (or on explicit reload). Tools and scope
validation read this singleton — catalog rows are not dumped into per-turn
LangGraph checkpoint state.
"""

from __future__ import annotations

import json
import os
import re
import threading
from pathlib import Path
from typing import Any


AREA_NAMES: dict[str, str] = {
    "computing-technology": "Computing and Technology",
    "engineering-science": "Engineering and Science",
    "business-economics": "Business and Economics",
    "health-medicine": "Health and Medicine",
    "society-humanities": "Society and Humanities",
}

AREA_ALIASES: dict[str, list[str]] = {
    "computing-technology": [
        "computing", "programming", "computer science", "software", "coding", "tech", "it", "ai",
        "artificial intelligence", "data science", "cyber", "cybersecurity",
    ],
    "business-economics": [
        "business", "management", "mba", "entrepreneur", "commerce", "economics", "finance",
    ],
    "engineering-science": [
        "engineering", "mechanical", "civil engineering", "electrical", "architecture", "biotech",
    ],
    "health-medicine": [
        "health", "healthcare", "medicine", "medical", "nursing", "dentistry", "psychology",
    ],
    "society-humanities": [
        "humanities", "society", "languages", "arts", "social", "culture", "english",
    ],
    # Short keys kept for legacy discover mapping / older catalog_areas payloads.
    "computing": ["programming", "computer science", "software", "coding", "tech", "it"],
    "business": ["business", "management", "mba", "entrepreneur", "commerce"],
    "engineering": ["engineering", "mechanical", "civil engineering", "electrical"],
}


def area_display_name(area_id: str) -> str:
    key = str(area_id or "")
    if key in AREA_NAMES:
        return AREA_NAMES[key]
    return key.replace("-", " ").title() if key else ""


def _default_seed_dirs() -> list[Path]:
    env = os.getenv("CATALOG_SEED_DIR", "").strip()
    candidates: list[Path] = []
    if env:
        candidates.append(Path(env))
    here = Path(__file__).resolve()
    candidates.extend([
        Path("/app/catalog"),
        here.parents[2] / "scripts" / "catalog",  # repo root from services/agent-server/agent_server
        here.parents[1] / "catalog",
        Path.cwd() / "catalog",
        Path.cwd() / "scripts" / "catalog",
    ])
    return candidates


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _norm(text: str) -> str:
    return " ".join(str(text or "").lower().split())


class CatalogIndex:
    """In-memory indexes over areas, families, courses, and institutions."""

    def __init__(self) -> None:
        self.seed_version = ""
        self.families: list[dict[str, Any]] = []
        self.courses: list[dict[str, Any]] = []
        self.institutions: list[dict[str, Any]] = []
        self._by_family: dict[str, dict[str, Any]] = {}
        self._by_course: dict[str, dict[str, Any]] = {}
        self._by_institution: dict[str, dict[str, Any]] = {}
        self._families_by_area: dict[str, list[dict[str, Any]]] = {}
        self._courses_by_family: dict[str, list[dict[str, Any]]] = {}
        self._courses_by_institution: dict[str, list[dict[str, Any]]] = {}
        self._courses_by_area: dict[str, list[dict[str, Any]]] = {}

    @property
    def area_ids(self) -> list[str]:
        return sorted(self._families_by_area.keys())

    def family_ids(self) -> set[str]:
        return set(self._by_family)

    def course_ids(self) -> set[str]:
        return set(self._by_course)

    def institution_ids(self) -> set[str]:
        return set(self._by_institution)

    def get_family(self, family_id: str) -> dict[str, Any] | None:
        return self._by_family.get(family_id)

    def get_course(self, course_id: str) -> dict[str, Any] | None:
        return self._by_course.get(course_id)

    def get_institution(self, institution_id: str) -> dict[str, Any] | None:
        return self._by_institution.get(institution_id)

    def families_for_area(self, area_id: str) -> list[dict[str, Any]]:
        return list(self._families_by_area.get(area_id, []))

    def compact_area(self, area_id: str) -> dict[str, Any]:
        families = self.families_for_area(area_id)
        sample_names = [str(row.get("name") or "") for row in families[:4] if row.get("name")]
        return {
            "areaId": area_id,
            "name": area_display_name(area_id),
            "familyCount": len(families),
            "sampleFamilyNames": sample_names,
            "description": (
                f"Includes course types such as {', '.join(sample_names)}."
                if sample_names
                else "Browse course types in this field of study."
            ),
        }

    def list_areas(self) -> list[dict[str, Any]]:
        return [self.compact_area(area_id) for area_id in self.area_ids]

    def courses_for_family(self, family_id: str) -> list[dict[str, Any]]:
        return list(self._courses_by_family.get(family_id, []))

    def compact_family(self, row: dict[str, Any]) -> dict[str, Any]:
        family_id = str(row.get("familyId") or "")
        return {
            "familyId": family_id,
            "areaId": row.get("areaId"),
            "name": row.get("name"),
            "aliases": row.get("aliases") or [],
            "offeringCount": len(self._courses_by_family.get(family_id, [])),
        }

    def compact_course(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "courseId": row.get("courseId"),
            "familyId": row.get("familyId"),
            "name": row.get("name"),
            "institutionId": row.get("institutionId"),
            "institutionName": row.get("institutionName"),
            "country": row.get("country"),
            "city": row.get("city"),
            "level": row.get("level"),
            "area": row.get("area"),
        }

    def compact_institution(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "institutionId": row.get("institutionId"),
            "name": row.get("name"),
            "country": row.get("country"),
            "city": row.get("city"),
            "aliases": row.get("aliases") or [],
            "offeringCount": len(self._courses_by_institution.get(str(row.get("institutionId") or ""), [])),
        }

    def map_interest_to_area(self, phrase: str) -> dict[str, Any]:
        raw = str(phrase or "").strip()[:256]
        normalized = _norm(raw)
        if not normalized:
            return {"areaId": "", "confidence": "none", "candidates": [], "studentPhrase": raw}

        scored: dict[str, int] = {}
        for area_id in self.area_ids:
            labels = [area_id.replace("-", " "), area_id, *AREA_ALIASES.get(area_id, [])]
            for family in self.families_for_area(area_id):
                labels.append(str(family.get("name") or ""))
                labels.extend(str(alias) for alias in (family.get("aliases") or []))
            score = 0
            for label in labels:
                label_n = _norm(label)
                if not label_n:
                    continue
                if re.search(rf"(?:^|[^a-z0-9_]){re.escape(label_n)}(?:$|[^a-z0-9_])", normalized):
                    score += 2 if label_n in AREA_ALIASES.get(area_id, []) or label_n == area_id.replace("-", " ") else 1
            if score:
                scored[area_id] = score

        ranked = sorted(scored.items(), key=lambda item: (-item[1], item[0]))
        candidates = [{"areaId": area_id, "score": score} for area_id, score in ranked[:5]]
        if not candidates:
            return {"areaId": "", "confidence": "none", "candidates": [], "studentPhrase": raw}
        top_id, top_score = ranked[0]
        confidence = "high" if top_score >= 2 and (len(ranked) == 1 or top_score > ranked[1][1]) else "medium"
        return {
            "areaId": top_id,
            "confidence": confidence,
            "candidates": candidates,
            "studentPhrase": raw,
        }

    def list_courses(
        self,
        *,
        family_id: str = "",
        area_id: str = "",
        institution_id: str = "",
        country: str = "",
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        rows = self.courses
        if family_id:
            rows = self._courses_by_family.get(family_id, [])
        elif area_id:
            rows = self._courses_by_area.get(area_id, [])
        if institution_id:
            rows = [row for row in rows if str(row.get("institutionId") or "") == institution_id]
        if country:
            country_n = _norm(country)
            rows = [row for row in rows if _norm(str(row.get("country") or "")) == country_n]
        capped = max(1, min(int(limit or 50), 100))
        return [self.compact_course(row) for row in rows[:capped]]

    def find_institution(self, query: str, *, limit: int = 8) -> list[dict[str, Any]]:
        needle = _norm(query)
        if not needle:
            return []
        hits: list[tuple[int, dict[str, Any]]] = []
        for row in self.institutions:
            name = _norm(str(row.get("name") or ""))
            aliases = [_norm(str(alias)) for alias in (row.get("aliases") or [])]
            score = 0
            if needle == name or needle in aliases:
                score = 3
            elif needle in name or any(needle in alias for alias in aliases if alias):
                score = 2
            elif name and (name in needle):
                score = 1
            if score:
                hits.append((score, row))
        hits.sort(key=lambda item: (-item[0], str(item[1].get("name") or "")))
        return [self.compact_institution(row) for _, row in hits[: max(1, min(limit, 20))]]

    def load_rows(
        self,
        *,
        families: list[dict[str, Any]],
        courses: list[dict[str, Any]],
        institutions: list[dict[str, Any]] | None = None,
        seed_version: str = "",
    ) -> None:
        self.seed_version = seed_version
        self.families = [dict(row) for row in families if row.get("active", True) is not False]
        self.courses = [dict(row) for row in courses if row.get("active", True) is not False]
        if institutions:
            self.institutions = [dict(row) for row in institutions if row.get("active", True) is not False]
        else:
            derived: dict[str, dict[str, Any]] = {}
            for course in self.courses:
                institution_id = str(course.get("institutionId") or "")
                if not institution_id or institution_id in derived:
                    continue
                derived[institution_id] = {
                    "institutionId": institution_id,
                    "name": course.get("institutionName") or institution_id,
                    "country": course.get("country") or "",
                    "city": course.get("city") or "",
                    "aliases": course.get("institutionAliases") or [],
                    "active": True,
                }
            self.institutions = list(derived.values())

        self._by_family = {str(row.get("familyId") or ""): row for row in self.families if row.get("familyId")}
        self._by_course = {str(row.get("courseId") or ""): row for row in self.courses if row.get("courseId")}
        self._by_institution = {
            str(row.get("institutionId") or ""): row for row in self.institutions if row.get("institutionId")
        }
        self._families_by_area = {}
        for row in self.families:
            area_id = str(row.get("areaId") or "")
            self._families_by_area.setdefault(area_id, []).append(row)
        self._courses_by_family = {}
        self._courses_by_institution = {}
        self._courses_by_area = {}
        for row in self.courses:
            family_id = str(row.get("familyId") or "")
            institution_id = str(row.get("institutionId") or "")
            self._courses_by_family.setdefault(family_id, []).append(row)
            self._courses_by_institution.setdefault(institution_id, []).append(row)
            family = self._by_family.get(family_id)
            area_id = str((family or {}).get("areaId") or row.get("area") or "")
            if area_id:
                self._courses_by_area.setdefault(area_id, []).append(row)

    def load_seed_dir(self, directory: Path) -> None:
        families = _read_json(directory / "families.json")
        courses = _read_json(directory / "courses.json")
        institutions_path = directory / "institutions.json"
        institutions = _read_json(institutions_path) if institutions_path.exists() else None
        policy_path = directory / "policy.json"
        seed_version = ""
        if policy_path.exists():
            policy = _read_json(policy_path)
            seed_version = str(policy.get("seedVersion") or "")
        self.load_rows(
            families=families,
            courses=courses,
            institutions=institutions,
            seed_version=seed_version,
        )


_lock = threading.RLock()
_index = CatalogIndex()
_loaded = False


def get_catalog_index() -> CatalogIndex:
    ensure_catalog_loaded()
    return _index


def ensure_catalog_loaded() -> CatalogIndex:
    global _loaded
    with _lock:
        if _loaded and (_index.courses or _index.families):
            return _index
        for directory in _default_seed_dirs():
            if (directory / "families.json").exists() and (directory / "courses.json").exists():
                _index.load_seed_dir(directory)
                _loaded = True
                return _index
        _loaded = True
        return _index


def reload_catalog_index(
    *,
    families: list[dict[str, Any]] | None = None,
    courses: list[dict[str, Any]] | None = None,
    institutions: list[dict[str, Any]] | None = None,
    seed_version: str = "",
    seed_dir: str | Path | None = None,
) -> CatalogIndex:
    """Replace the process index (tests, version refresh, fixtures)."""
    global _loaded
    with _lock:
        if seed_dir is not None:
            _index.load_seed_dir(Path(seed_dir))
        elif families is not None and courses is not None:
            _index.load_rows(
                families=families,
                courses=courses,
                institutions=institutions,
                seed_version=seed_version,
            )
        else:
            _loaded = False
            return ensure_catalog_loaded()
        _loaded = True
        return _index


def load_fixture(
    *,
    families: list[dict[str, Any]],
    courses: list[dict[str, Any]],
    institutions: list[dict[str, Any]] | None = None,
    seed_version: str = "fixture",
) -> CatalogIndex:
    return reload_catalog_index(
        families=families,
        courses=courses,
        institutions=institutions,
        seed_version=seed_version,
    )

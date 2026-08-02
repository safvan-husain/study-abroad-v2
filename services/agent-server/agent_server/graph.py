from __future__ import annotations

import json
import os
import re
from typing import Annotated, Any, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

AREA_ALIASES: dict[str, list[str]] = {
    "computing": ["programming", "computer science", "software", "coding", "tech", "it"],
    "business": ["business", "management", "mba", "entrepreneur", "commerce"],
    "engineering": ["engineering", "mechanical", "civil engineering", "electrical"],
    "medicine": ["medicine", "medical", "doctor"],
    "health": ["health", "nursing", "healthcare", "optometry"],
    "hospitality": ["hospitality", "tourism", "hotel"],
    "media": ["media", "film", "audiovisual"],
    "economics": ["economics", "finance", "economy"],
    "data_science": ["data science", "data analytics", "analytics"],
    "artificial_intelligence": ["ai", "artificial intelligence", "machine learning"],
    "law": ["law", "legal"],
    "psychology": ["psychology"],
    "science": ["science", "biology", "chemistry", "physics"],
    "cybersecurity": ["cyber security", "cybersecurity"],
}


class DiscoveryState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    catalog_areas: list[str]
    profile: dict[str, Any]
    task: str
    course: dict[str, Any]
    discovery_result: dict[str, Any]
    course_fit_result: dict[str, Any]


def _latest_human_text(messages: list[BaseMessage] | list[Any]) -> str:
    for message in reversed(messages):
        message_type = getattr(message, "type", None) or (message.get("type") if isinstance(message, dict) else None)
        role = getattr(message, "role", None) or (message.get("role") if isinstance(message, dict) else None)
        if isinstance(message, HumanMessage) or message_type == "human" or role == "human":
            content = getattr(message, "content", None) or (message.get("content") if isinstance(message, dict) else "")
            return content if isinstance(content, str) else str(content)
    return ""


def _map_phrase(phrase: str, catalog_areas: list[str]) -> dict[str, Any]:
    raw = phrase.strip()[:256]
    if not raw:
        return {"studentPhrase": "", "catalogAreas": [], "status": "unmapped"}
    normalized = raw.lower()
    area_scores: dict[str, int] = {}
    retained: list[str] = []
    for area in catalog_areas:
        key = area.lower()
        labels = [key.replace("_", " "), key, *AREA_ALIASES.get(key, [])]
        for label in labels:
            if not label:
                continue
            pattern = rf"(?:^|[^a-z0-9_]){re.escape(label)}(?:$|[^a-z0-9_])"
            if not re.search(pattern, normalized, re.I):
                continue
            area_scores[area] = max(area_scores.get(area, 0), len(label))
            retained.append(label)
    unique = [
        area
        for area, _score in sorted(area_scores.items(), key=lambda row: (-row[1], row[0]))
    ][:8]
    student_phrase = (sorted(retained, key=len, reverse=True)[0] if retained else raw)[:256]
    return {
        "studentPhrase": student_phrase,
        "catalogAreas": unique,
        "status": "mapped" if unique else "unmapped",
    }


_DISALLOWED_FIT_CLAIMS = re.compile(
    r"\b(admission|admitted|visa|scholarship|eligible|eligibility|approved|approval|guaranteed?|guarantee)\b",
    re.I,
)


def _is_indicative_fit_text(text: str) -> bool:
    normalized = " ".join(text.split())
    if not normalized or len(normalized) > 2000:
        return False
    return _DISALLOWED_FIT_CLAIMS.search(normalized) is None


def _extract_profile(text: str, existing: dict[str, Any], intent: dict[str, Any]) -> dict[str, Any]:
    background = existing.get("background") or ""
    ambitions = existing.get("ambitions") or ""
    interests = existing.get("courseInterests") or intent.get("studentPhrase") or ""
    if re.search(r"\b(bachelor|grade|school|college|studied|studying|gpa|percent)\b", text, re.I):
        background = text[:512] if not background else background
    if re.search(r"\b(want|hope|career|goal|ambition)\b", text, re.I):
        ambitions = text[:512]
    if intent.get("studentPhrase"):
        interests = intent["studentPhrase"]
    return {
        "background": str(background)[:1024],
        "courseInterests": str(interests)[:1024],
        "ambitions": str(ambitions)[:1024],
        "primaryArea": (intent.get("catalogAreas") or [""])[0] if intent.get("catalogAreas") else existing.get("primaryArea", ""),
        "candidateAreas": intent.get("catalogAreas") or existing.get("candidateAreas") or [],
        "studentPhrase": intent.get("studentPhrase") or existing.get("studentPhrase") or "",
        "constraintsText": str(existing.get("constraintsText") or "")[:1024],
    }


def _ollama_chat(system: str, human: str) -> str | None:
    host = os.getenv("OLLAMA_HOST", "").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "gemma4:31b")
    api_key = os.getenv("OLLAMA_API_KEY", "")
    if not host:
        return None
    try:
        from langchain_ollama import ChatOllama

        llm = ChatOllama(
            model=model,
            base_url=host,
            temperature=0,
            client_kwargs={"headers": {"Authorization": f"Bearer {api_key}"}} if api_key else None,
        )
        response = llm.invoke([("system", system), ("human", human)])
        content = response.content
        return content if isinstance(content, str) else str(content)
    except Exception:
        return None


def run_discovery(state: DiscoveryState) -> dict[str, Any]:
    text = _latest_human_text(state["messages"])
    catalog_areas = state.get("catalog_areas") or []
    profile = state.get("profile") or {}

    model_text = _ollama_chat(
        "Extract study interests briefly. Reply with one short acknowledgement sentence for the student. "
        "Do not list courses. Keep the student's own wording for their interest when possible.",
        text,
    )
    intent = _map_phrase(text, catalog_areas)
    if intent["status"] == "unmapped" and model_text:
        # Keep honest unmapped status; model may still write a helpful ack.
        pass
    profile_patch = _extract_profile(text, profile, intent)

    if intent["status"] == "mapped":
        phrase = intent["studentPhrase"]
        assistant = (
            model_text
            or f"Thanks — I am looking through partner courses related to {phrase} and will organize matches in your workspace."
        )
        directive = {
            "type": "catalog",
            "awareness": f"Showing courses related to {phrase}.",
        }
    else:
        phrase = intent["studentPhrase"] or "your interests"
        assistant = (
            model_text
            or f"Thanks for sharing. I could not map {phrase} to an exact partner-catalogue area yet — tell me a bit more about the subjects or careers you have in mind."
        )
        directive = {
            "type": "discovery",
            "awareness": "Learning about your background and study interests.",
        }

    result = {
        "assistantContent": assistant[:16000],
        "profilePatch": profile_patch,
        "discoveryIntent": intent,
        "directive": directive,
        "workItems": [],
        "workKind": "",
    }
    return {
        "messages": [AIMessage(content=assistant[:16000])],
        "discovery_result": result,
    }


def run_course_fit(state: DiscoveryState) -> dict[str, Any]:
    course = state.get("course") or {}
    profile = state.get("profile") or {}
    phrase = str(profile.get("studentPhrase") or course.get("studentPhrase") or "your interests")
    title = str(course.get("name") or "Course match")
    institution = str(course.get("institutionName") or "")
    area = str(course.get("area") or "")
    country = str(course.get("country") or "")
    detail = (
        f"This {area or 'partner'} programme at {institution or 'a partner university'} in {country or 'Europe'} "
        f"is an indicative fit for someone interested in {phrase}. Confirm details with a counsellor before applying."
    )
    model_text = _ollama_chat(
        "Write one short paragraph (max 60 words) explaining why this course may fit the student. "
        "Use only provided facts. Do not claim admission, visa, scholarship, or eligibility outcomes. Use indicative language.",
        json.dumps({"course": course, "profile": profile}),
    )
    if model_text and _is_indicative_fit_text(model_text):
        detail = model_text[:2000]
    result = {
        "entityType": "course",
        "entityId": str(course.get("courseId") or ""),
        "title": title[:256],
        "detail": detail,
        "institutionName": institution[:256],
        "area": area[:64],
        "country": country[:64],
        "studentPhrase": phrase[:256],
    }
    return {
        "messages": [AIMessage(content=detail)],
        "course_fit_result": result,
    }


def route_task(state: DiscoveryState) -> str:
    return "course_fit" if state.get("task") == "course_fit" else "discover"


builder = StateGraph(DiscoveryState)
builder.add_node("discover", run_discovery)
builder.add_node("course_fit", run_course_fit)
builder.add_conditional_edges(START, route_task, {"discover": "discover", "course_fit": "course_fit"})
builder.add_edge("discover", END)
builder.add_edge("course_fit", END)
graph = builder.compile()

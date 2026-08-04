"""Opt-in live LLM tests for advisor routing and discovery.

These tests call real Ollama models (ROUTER_MODEL, DISCOVERY_MODEL, etc.).
They are skipped unless explicitly enabled — never run in default CI.

Enable::

    RUN_LIVE_LLM_TESTS=1 OLLAMA_HOST=https://… uv run pytest tests/test_graph_live.py -v

Requires OLLAMA_HOST and must not set OLLAMA_DISABLED.
"""

from __future__ import annotations

import os

import pytest
from langchain_core.messages import HumanMessage

from agent_server.graph import route_intent
from agent_server.initial_state import initial_discover_state

from tests.catalog_fixtures import COURSES, FAMILIES, COMPUTING_AREA_ID

INTEREST_MESSAGE = "Hi, I like to learn computer programming or computer science."


def _live_llm_enabled() -> bool:
    flag = os.getenv("RUN_LIVE_LLM_TESTS", "").lower()
    host = os.getenv("OLLAMA_HOST", "").strip()
    disabled = os.getenv("OLLAMA_DISABLED", "").lower() in {"1", "true", "yes"}
    return flag in {"1", "true", "yes"} and bool(host) and not disabled


pytestmark = [
    pytest.mark.live_llm,
    pytest.mark.skipif(
        not _live_llm_enabled(),
        reason="Live LLM tests are opt-in: set RUN_LIVE_LLM_TESTS=1 and OLLAMA_HOST.",
    ),
]


def test_programming_interest_statement_routes_to_discovery_live():
    """Broad subject interest must not be classified as guidance."""
    state = initial_discover_state(
        messages=[HumanMessage(content=INTEREST_MESSAGE)],
        catalog_areas=[COMPUTING_AREA_ID],
        catalog_families=FAMILIES,
        catalog_courses=COURSES,
    )
    update = route_intent(state)
    route = update["route_decision"]

    assert route["intent"] == "discovery", route

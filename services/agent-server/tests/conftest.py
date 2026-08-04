"""Pytest fixtures: load the process catalog index used by discovery tools."""

from __future__ import annotations

import pytest

from agent_server.catalog_index import load_fixture
from tests.catalog_fixtures import COURSES, FAMILIES


@pytest.fixture(autouse=True)
def _seed_process_catalog():
    load_fixture(families=FAMILIES, courses=COURSES, seed_version="test-fixture")
    yield

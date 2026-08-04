#!/usr/bin/env python3
"""Run eval scenarios against a live Agent Server.

Usage (from services/agent-server)::

    uv run python eval/run_scenarios.py
    uv run python eval/run_scenarios.py --id computing-interest-cold-start

Resolves AGENT_SERVER_URL / AGENT_SERVER_PUBLIC_URL from the repo ``.env``.
On the production Compose stack, port ``2024`` is not published on the host —
use the HTTPS proxy URL (with ``AGENT_SERVER_ACCESS_TOKEN``) or reach
``http://agent-server:2024`` from a container on the same Docker network.
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import sys
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from langgraph_sdk import get_client

EVAL_DIR = Path(__file__).resolve().parent
REPO_ROOT = EVAL_DIR.parents[2]
SCENARIOS_PATH = EVAL_DIR / "scenarios.json"
DEFAULT_GRAPH_ID = os.getenv("SMOKE_TEST_GRAPH_ID", os.getenv("AGENT_GRAPH_ID", "agent"))
DEFAULT_PUBLIC_URL = "https://agent.200-141-7-99.sslip.io"


def _load_dotenv() -> None:
    env_path = REPO_ROOT / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, _, value = raw.partition("=")
        key = key.strip()
        if not key or key in os.environ:
            continue
        os.environ[key] = value.strip().strip("'").strip('"')


def _host_reachable(url: str, timeout: float = 1.0) -> bool:
    parsed = urlparse(url)
    host = parsed.hostname
    if not host:
        return False
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def resolve_agent_url(explicit: str | None = None) -> str:
    """Pick a reachable Agent Server base URL for this host."""
    candidates: list[str] = []
    if explicit:
        candidates.append(explicit.rstrip("/"))
    for key in ("AGENT_SERVER_URL", "AGENT_SERVER_PUBLIC_URL"):
        value = os.getenv(key, "").strip().rstrip("/")
        if value and value not in candidates:
            candidates.append(value)
    for fallback in ("http://127.0.0.1:2024", DEFAULT_PUBLIC_URL):
        if fallback not in candidates:
            candidates.append(fallback)

    for url in candidates:
        if _host_reachable(url):
            return url

    hint = (
        "Could not reach Agent Server. On this VPS, Compose does not publish :2024.\n"
        "Use the HTTPS proxy, for example:\n"
        f"  AGENT_SERVER_URL={DEFAULT_PUBLIC_URL} \\\n"
        "  AGENT_SERVER_ACCESS_TOKEN=… \\\n"
        "  uv run python eval/run_scenarios.py\n"
        "Or from the Docker network: http://agent-server:2024"
    )
    raise SystemExit(hint)


def load_scenarios(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list) or not data:
        raise SystemExit(f"Expected a non-empty JSON array in {path}")
    return data


def empty_profile() -> dict[str, Any]:
    return {
        "background": "",
        "courseInterests": "",
        "ambitions": "",
        "primaryArea": "",
        "candidateAreas": [],
        "studentPhrase": "",
        "constraintsText": "",
    }


def empty_selection() -> dict[str, Any]:
    return {
        "presentedFamilyIds": [],
        "presentedOfferingIds": [],
        "provisionalOfferingIds": [],
        "suppressedOfferingIds": [],
        "revision": "0",
    }


def build_input(scenario: dict[str, Any]) -> dict[str, Any]:
    selection = dict(empty_selection())
    selection.update(scenario.get("selectionContext") or {})
    if "revision" not in selection:
        selection["revision"] = "0"
    else:
        selection["revision"] = str(selection["revision"])
    return {
        "messages": [{"role": "human", "content": scenario["message"]}],
        "catalog_areas": [],
        "catalog_families": [],
        "catalog_courses": [],
        "profile": empty_profile(),
        "ui_context": dict(scenario.get("uiContext") or {}),
        "selection_context": selection,
        "graph_version": os.getenv("ADVISOR_GRAPH_VERSION", "specialist"),
        "task": "discover",
        "course": {},
    }


def extract_outcomes(output: dict[str, Any]) -> dict[str, Any]:
    advisor = output.get("advisor_result") if isinstance(output.get("advisor_result"), dict) else {}
    route = advisor.get("route") if isinstance(advisor.get("route"), dict) else output.get("route_decision") or {}
    scope = advisor.get("scope") if isinstance(advisor.get("scope"), dict) else output.get("scope_decision") or {}
    messages = output.get("messages") or []
    last_ai = ""
    for message in reversed(messages):
        if not isinstance(message, dict):
            continue
        if message.get("type") == "ai" or message.get("role") == "ai":
            content = message.get("content")
            last_ai = content if isinstance(content, str) else str(content or "")
            break
    return {
        "routeIntent": str(route.get("intent") or ""),
        "scope": str(scope.get("scope") or ""),
        "areaId": str(scope.get("areaId") or ""),
        "familyIds": [str(row) for row in (scope.get("familyIds") or [])],
        "offeringIds": [str(row) for row in (scope.get("offeringIds") or [])],
        "assistantPreview": last_ai[:120],
    }


def _ids_cover(expected: list[str], actual: list[str]) -> bool:
    """True when every expected id appears in actual (order-insensitive)."""
    actual_set = set(actual)
    return all(item in actual_set for item in expected)


def evaluate(expect: dict[str, Any], actual: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    route = actual.get("routeIntent") or ""
    scope = actual.get("scope") or ""

    if "routeIntent" in expect and route != expect["routeIntent"]:
        failures.append(f"routeIntent expected={expect['routeIntent']!r} actual={route!r}")
    if "routeIntentIn" in expect:
        allowed = list(expect["routeIntentIn"] or [])
        if route not in allowed:
            failures.append(f"routeIntent expected in {allowed!r} actual={route!r}")

    # Scope checks apply when discovery produced a scope, or when expect requires one.
    require_scope = any(key in expect for key in ("scope", "scopeIn", "areaId", "familyIds", "offeringIds", "minOfferingCount"))
    if require_scope and route == "guidance":
        failures.append("expected a catalog scope outcome but routeIntent=guidance")
        return failures

    if "scope" in expect and scope != expect["scope"]:
        # Allow route-level clarify without a scope_decision payload.
        if not (expect["scope"] == "clarify" and route == "clarify" and not scope):
            failures.append(f"scope expected={expect['scope']!r} actual={scope!r}")
    if "scopeIn" in expect:
        allowed_scopes = list(expect["scopeIn"] or [])
        if scope not in allowed_scopes and not (route == "clarify" and "clarify" in allowed_scopes and not scope):
            failures.append(f"scope expected in {allowed_scopes!r} actual={scope!r}")

    if "areaId" in expect and expect["areaId"]:
        # For family_offerings the model may leave areaId empty; accept if families imply the area later.
        if actual.get("areaId") != expect["areaId"] and expect.get("scope") == "area_overview":
            failures.append(f"areaId expected={expect['areaId']!r} actual={actual.get('areaId')!r}")
        elif actual.get("areaId") and actual.get("areaId") != expect["areaId"]:
            failures.append(f"areaId expected={expect['areaId']!r} actual={actual.get('areaId')!r}")
        elif not actual.get("areaId") and expect.get("scopeIn") and "area_overview" in (expect.get("scopeIn") or []) and scope == "area_overview":
            failures.append(f"areaId expected={expect['areaId']!r} actual=''")

    if "familyIds" in expect:
        if not _ids_cover([str(row) for row in expect["familyIds"]], list(actual.get("familyIds") or [])):
            failures.append(f"familyIds expected to include {expect['familyIds']!r} actual={actual.get('familyIds')!r}")
    if "offeringIds" in expect:
        if not _ids_cover([str(row) for row in expect["offeringIds"]], list(actual.get("offeringIds") or [])):
            failures.append(f"offeringIds expected to include {expect['offeringIds']!r} actual={actual.get('offeringIds')!r}")
    if "minOfferingCount" in expect:
        count = len(actual.get("offeringIds") or [])
        if count < int(expect["minOfferingCount"]):
            failures.append(f"minOfferingCount expected>={expect['minOfferingCount']} actual={count}")
    return failures


async def run_scenario(client: Any, assistant_id: str, scenario: dict[str, Any]) -> dict[str, Any]:
    thread_id = str(uuid.uuid4())
    await client.threads.create(
        thread_id=thread_id,
        metadata={"conversation_id": thread_id, "eval_scenario": scenario["id"]},
        if_exists="do_nothing",
    )
    run_id: str | None = None

    def on_run_created(run: Any) -> None:
        nonlocal run_id
        run_id = getattr(run, "run_id", None) or (run.get("run_id") if isinstance(run, dict) else None)

    output = await client.runs.wait(
        thread_id,
        assistant_id,
        input=build_input(scenario),
        metadata={
            "conversation_id": thread_id,
            "eval_scenario": scenario["id"],
            **({"LANGGRAPH_API_URL": os.environ["LANGGRAPH_API_URL"]} if os.getenv("LANGGRAPH_API_URL") else {}),
        },
        multitask_strategy="reject",
        on_run_created=on_run_created,
    )
    if not isinstance(output, dict):
        output = dict(output) if output else {}
    actual = extract_outcomes(output)
    failures = evaluate(scenario.get("expect") or {}, actual)
    return {
        "id": scenario["id"],
        "pass": not failures,
        "failures": failures,
        "threadId": thread_id,
        "runId": run_id or "",
        "actual": actual,
    }


def print_report(results: list[dict[str, Any]]) -> None:
    width = max((len(row["id"]) for row in results), default=8)
    print(f"{'id'.ljust(width)}  result  route           scope                 areaId")
    print("-" * (width + 72))
    for row in results:
        actual = row["actual"]
        status = "PASS" if row["pass"] else "FAIL"
        print(
            f"{row['id'].ljust(width)}  {status}  "
            f"{(actual.get('routeIntent') or '-'):<14}  "
            f"{(actual.get('scope') or '-'):<20}  "
            f"{actual.get('areaId') or '-'}"
        )
        if row["failures"]:
            for failure in row["failures"]:
                print(f"  ! {failure}")
        if row.get("runId"):
            print(f"  thread={row['threadId']} run={row['runId']}")


async def amain(argv: list[str] | None = None) -> int:
    _load_dotenv()
    parser = argparse.ArgumentParser(description="Run Agent Server eval scenarios")
    parser.add_argument("--id", action="append", dest="ids", help="Run only this scenario id (repeatable)")
    parser.add_argument("--scenarios", type=Path, default=SCENARIOS_PATH, help="Path to scenarios.json")
    parser.add_argument("--url", default=None, help="Agent Server base URL (overrides env resolution)")
    parser.add_argument("--graph-id", default=os.getenv("SMOKE_TEST_GRAPH_ID", os.getenv("AGENT_GRAPH_ID", "agent")))
    args = parser.parse_args(argv)

    scenarios = load_scenarios(args.scenarios)
    if args.ids:
        wanted = set(args.ids)
        scenarios = [row for row in scenarios if row.get("id") in wanted]
        missing = wanted - {row.get("id") for row in scenarios}
        if missing:
            raise SystemExit(f"Unknown scenario id(s): {sorted(missing)}")

    url = resolve_agent_url(args.url)
    headers = {}
    token = os.getenv("AGENT_SERVER_ACCESS_TOKEN", "").strip()
    if token:
        headers["X-Agent-Server-Token"] = token

    print(f"Using Agent Server at {url}", flush=True)
    client = get_client(url=url, headers=headers or None)
    try:
        searched = await client.assistants.search(graph_id=args.graph_id, limit=1)
    except Exception as exc:  # noqa: BLE001
        raise SystemExit(
            f"Failed to reach Agent Server at {url}: {exc}\n"
            f"Try AGENT_SERVER_URL={DEFAULT_PUBLIC_URL} with AGENT_SERVER_ACCESS_TOKEN set."
        ) from exc
    if isinstance(searched, dict):
        assistants = list(searched.get("assistants") or searched.get("items") or [])
    else:
        assistants = list(searched or [])
    if assistants:
        first = assistants[0]
        assistant_id = first["assistant_id"] if isinstance(first, dict) else first.assistant_id
    else:
        created = await client.assistants.create(graph_id=args.graph_id, name=f"eval-{uuid.uuid4()}")
        assistant_id = created["assistant_id"] if isinstance(created, dict) else created.assistant_id

    results: list[dict[str, Any]] = []
    for scenario in scenarios:
        print(f"Running {scenario['id']}…", flush=True)
        try:
            results.append(await run_scenario(client, assistant_id, scenario))
        except Exception as exc:  # noqa: BLE001 — report and continue remaining cases
            results.append({
                "id": scenario["id"],
                "pass": False,
                "failures": [f"invoke error: {exc}"],
                "threadId": "",
                "runId": "",
                "actual": {"routeIntent": "", "scope": "", "areaId": "", "familyIds": [], "offeringIds": []},
            })

    print()
    print_report(results)
    passed = sum(1 for row in results if row["pass"])
    print(f"\n{passed}/{len(results)} passed")
    return 0 if passed == len(results) else 1


def main() -> None:
    import asyncio

    raise SystemExit(asyncio.run(amain()))


if __name__ == "__main__":
    main()

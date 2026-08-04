# Python Agent Server

This directory owns the active LangGraph runtime. `agent_server/graph.py` exposes a native `MessagesState` graph through `langgraph.json`; the TypeScript worker/client talks to it only over Agent Server HTTP and must not import this package.

The **catalog** is a process-level index (`agent_server/catalog_index.py`) loaded from `CATALOG_SEED_DIR` (Docker: `/app/catalog`, same JSON as `scripts/catalog/`). Discovery tools read that index; per-turn invokes carry messages, profile, and UI/selection context only — not the full course dump.

From this directory, install dependencies with `uv sync --extra test` and run `uv run langgraph dev --host 127.0.0.1 --port 2024`. From the repository root, run `pnpm agent:chat:smoke` to send two sequential native `human` messages on one stable thread and validate the accumulated `human`/`ai` state and distinct run IDs.

Offline tests: `uv run pytest tests/test_graph.py tests/test_state_updates.py tests/test_initial_state.py tests/test_catalog_tools.py -v`

Live LLM tests (opt-in only; see root `AGENTS.md`): `RUN_LIVE_LLM_TESTS=1 OLLAMA_HOST=https://… uv run pytest tests/test_graph_live.py -v`

## Eval scenarios

Labeled discovery/guidance cases live in `eval/scenarios.json`. They exercise cold-start area mapping, presented-family “show all these”, institution probes, comparison, guidance, and clarify — without dumping the catalog into the invoke payload (the server process index supplies IDs).

With Agent Server up and models reachable:

```bash
# from services/agent-server — loads repo-root .env and picks a reachable URL
uv run python eval/run_scenarios.py
uv run python eval/run_scenarios.py --id computing-interest-cold-start
```

On the production Compose stack, container port `2024` is **not** published on the host (`.env` `AGENT_SERVER_URL=http://localhost:2025` will not work from the VPS shell). Use the HTTPS proxy:

```bash
AGENT_SERVER_URL=https://agent.200-141-7-99.sslip.io \
AGENT_SERVER_ACCESS_TOKEN=… \
uv run python eval/run_scenarios.py
```

Or call `http://agent-server:2024` from a process on the Compose Docker network. Local `uv run langgraph dev --port 2024` still works with the default localhost URL.

The runner prints pass/fail per case (route, scope, areaId) and exits non-zero if any hard expect fails. Default CI does not run this script.

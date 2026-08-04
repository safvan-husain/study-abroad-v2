# Python Agent Server

This directory owns the active LangGraph runtime. `agent_server/graph.py` exposes a native `MessagesState` graph through `langgraph.json`; the TypeScript worker/client talks to it only over Agent Server HTTP and must not import this package.

From this directory, install dependencies with `uv sync --extra test` and run `uv run langgraph dev --host 127.0.0.1 --port 2024`. From the repository root, run `pnpm agent:chat:smoke` to send two sequential native `human` messages on one stable thread and validate the accumulated `human`/`ai` state and distinct run IDs.

Offline tests: `uv run pytest tests/test_graph.py tests/test_state_updates.py tests/test_initial_state.py -v`

Live LLM tests (opt-in only; see root `AGENTS.md`): `RUN_LIVE_LLM_TESTS=1 OLLAMA_HOST=https://… uv run pytest tests/test_graph_live.py -v`

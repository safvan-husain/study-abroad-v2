# Repository Context

The Version 1 implementation of this project is located at:

- Linux: `/root/study-abroad`
- macOS: `/Users/safvanhusain/code/inside/study-abroad`

When working on Version 1 or comparing behavior with the previous implementation, use the path matching the current operating system.

## Local Dev Stack (fast iteration)

For day-to-day coding, use the **host dev stack**: SpacetimeDB, web, API, AI worker, and Agent Server all run on the host with hot reload. Copy `.env.example` to `.env` before the first run.

```sh
pnpm dev                 # host SpacetimeDB + publish coordinator + all host services
pnpm dev:status          # show host service status
pnpm dev:stop            # stop host services (SpacetimeDB keeps running)
pnpm dev:stop:spacetimedb # stop host services and SpacetimeDB
pnpm dev:reset-db        # wipe local SpacetimeDB data and republish coordinator
pnpm dev:republish       # rebuild/publish coordinator after Rust schema changes
```

**Restart only what changed** (from a second terminal while the stack is up):

```sh
pnpm dev:restart:web        # Next.js only
pnpm dev:restart:api        # NestJS API only
pnpm dev:restart:web-api    # web + API
pnpm dev:restart:worker     # AI worker only
pnpm dev:restart:agent      # LangGraph Agent Server only
pnpm dev:restart            # all four host services
```

**Ports (host dev stack):**

| Service | URL |
|---------|-----|
| Web | `http://localhost:3100` |
| API | `http://localhost:3101/health` |
| SpacetimeDB | `ws://localhost:3002` |
| Agent Server | `http://localhost:2025` |

After completing a feature or fix, verify in the browser at `http://localhost:3100`. Restart the affected service if the change is not picked up automatically (`dev:restart:agent` for graph/routing changes, `dev:restart:worker` for worker logic, `dev:restart:web` for UI). Coordinator Rust changes require `pnpm dev:republish` (and often `pnpm coordinator:build` on the host for regenerated bindings), then restart web/api/worker as needed.

Logs are written under `.dev/logs/`. `pnpm dev` streams them in the foreground; Ctrl+C stops host services but leaves SpacetimeDB running for a fast `pnpm dev` restart.

## Docker And Browser Verification

For a fully containerized production-like topology (no hot reload), use the Compose stack:

- Build and start: `docker compose -f docker-compose.production.yml up -d --build`.
- Web UI: `http://localhost:3010/` (host port `3010`, not `3000`).
- Reset all persisted data: `docker compose -f docker-compose.production.yml down -v`.
- After making application changes, rebuild the affected service before browser or Playwright verification, e.g. `docker compose -f docker-compose.production.yml up -d --build web`.

Use Playwright against whichever stack you started (`3100` for `pnpm dev`, `3010` for Docker web).

## Realtime Advisor Architecture

- Treat SpacetimeDB as the canonical shared state and incremental delivery channel for the browser and AI workers. A logical request may publish several committed updates; do not force all generated workspace content into one HTTP-style response or wait for every independent item before showing useful results.
- Separate the primary conversational turn from follow-up workspace work. For UI-directed requests such as opening or comparing courses, publish a short chat acknowledgement and a pending workspace directive first, then render detailed results only in the left workspace as subscribed work items complete.
- Model independent work explicitly with a parent work set and one idempotent, lease-fenced child item per entity, such as one personalized summary per course. Child items may later be executed by LangGraph sub-agents and must commit independently so fast results are not blocked by slow ones.
- Persist UI-originated filter, context, shortlist, and navigation changes through authorized reducers. Record a typed user-action event in the same transaction when provenance is useful, but do not manufacture a chat message, system message, or immediate agent turn for routine removals.
- Before every parent or child agent execution, read the latest canonical state and treat it as authoritative over checkpoint state. Typed recent user actions may be supplied through a separate graph-state channel; stale child output must not restore removed context or steal focus from newer user navigation.
- Keep chat prose and workspace payloads distinct. Chat may explain genuinely conversational answers, but commands whose purpose is to change or populate the left workspace should acknowledge the action without duplicating course cards, comparisons, or personalized summaries in the transcript.

## Agent Server Tests

- Default pytest runs must stay **offline**: mock Ollama (`OLLAMA_DISABLED=true`) or monkeypatch `_ollama_json` / `_ollama_chat`. CI and routine `uv run pytest` must never call a live model.
- The course catalog is a **process-level index** (`agent_server/catalog_index.py`) loaded from seed JSON (`CATALOG_SEED_DIR`, Docker `/app/catalog`). Tests seed it via `tests/conftest.py`; do not rely on per-turn `catalog_courses` in invoke state.
- **Live LLM tests** live in `services/agent-server/tests/test_graph_live.py`. They are marked `@pytest.mark.live_llm` and skipped unless `RUN_LIVE_LLM_TESTS=1` (or `true`/`yes`) **and** `OLLAMA_HOST` is set, with `OLLAMA_DISABLED` unset.
- When changing advisor routing, scope resolution, or graph prompts in `services/agent-server/agent_server/graph.py`, update the matching deterministic tests in `tests/test_graph.py` and, when behavior depends on real model output, the opt-in live test in `tests/test_graph_live.py`.
- Run live tests explicitly from `services/agent-server`::

    RUN_LIVE_LLM_TESTS=1 OLLAMA_HOST=https://… uv run pytest tests/test_graph_live.py -v

  Do not add live LLM tests to default CI jobs or pre-commit hooks.

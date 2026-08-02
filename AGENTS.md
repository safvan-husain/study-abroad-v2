# Repository Context

The Version 1 implementation of this project is located at:

- Linux: `/root/study-abroad`
- macOS: `/Users/safvanhusain/code/inside/study-abroad`

When working on Version 1 or comparing behavior with the previous implementation, use the path matching the current operating system.

## Docker And Browser Verification

- The application runs entirely in Docker. There is no separately deployed module or external runtime to provision; use the repository's Docker Compose stack.
- Build and start the current stack before browser testing: `docker compose -f docker-compose.production.yml up -d --build`.
- The web application is published from container port `3000` on VPS host port `3010`. Use `http://localhost:3010/` on the VPS and `http://200.141.7.99:3010/` from an external machine.
- After making application changes or fixing an issue, verify the result with the Playwright CLI against the Docker-hosted application. Always rebuild the Docker container before running Playwright.

## Realtime Advisor Architecture

- Treat SpacetimeDB as the canonical shared state and incremental delivery channel for the browser and AI workers. A logical request may publish several committed updates; do not force all generated workspace content into one HTTP-style response or wait for every independent item before showing useful results.
- Separate the primary conversational turn from follow-up workspace work. For UI-directed requests such as opening or comparing courses, publish a short chat acknowledgement and a pending workspace directive first, then render detailed results only in the left workspace as subscribed work items complete.
- Model independent work explicitly with a parent work set and one idempotent, lease-fenced child item per entity, such as one personalized summary per course. Child items may later be executed by LangGraph sub-agents and must commit independently so fast results are not blocked by slow ones.
- Persist UI-originated filter, context, shortlist, and navigation changes through authorized reducers. Record a typed user-action event in the same transaction when provenance is useful, but do not manufacture a chat message, system message, or immediate agent turn for routine removals.
- Before every parent or child agent execution, read the latest canonical state and treat it as authoritative over checkpoint state. Typed recent user actions may be supplied through a separate graph-state channel; stale child output must not restore removed context or steal focus from newer user navigation.
- Keep chat prose and workspace payloads distinct. Chat may explain genuinely conversational answers, but commands whose purpose is to change or populate the left workspace should acknowledge the action without duplicating course cards, comparisons, or personalized summaries in the transcript.

## Cursor Cloud specific instructions

This environment is provisioned to run the full advisor stack in **local development mode** (with hot reload), which is the preferred way to develop here. The Docker Compose flow documented above still works but is the production build; use local dev for iteration. Docker is not installed in this environment by default.

### Services and dev ports (local dev)

The five services must be started in this order (each in its own long-lived shell/tmux session):

1. **SpacetimeDB** (canonical state): `spacetime start --listen-addr 127.0.0.1:3002 --data-dir "$HOME/.local/share/spacetime-advisor-data"`
2. **Publish coordinator** (once per fresh DB, and after any Rust schema change): `spacetime publish study-abroad-coordinator --server http://127.0.0.1:3002 --module-path coordinator/spacetimedb --yes` (add `--delete-data` to reset)
3. **Agent server** (LangGraph): `pnpm agent:dev` → `http://127.0.0.1:2025`
4. **AI worker**: `pnpm dev:worker`
5. **Web** (Next.js): `pnpm dev:web` → `http://localhost:3100`

Standard build/test/lint commands live in the root `package.json` scripts (`typecheck:all`, per-package `test`, `coordinator:build`, etc.); prefer those over duplicating commands here.

### Non-obvious caveats

- **Toolchain versions:** The SpacetimeDB CLI is pinned to `2.0.3` (`spacetime version use 2.0.3`) to match the Rust module's `spacetimedb = "=2.0.3"` dependency. The coordinator module uses Rust `edition = "2024"`, which needs Rust ≥ 1.85, so the default rustup toolchain must be `stable` (not the image's 1.83.0) with the `wasm32-unknown-unknown` target. `spacetime` and `uv` live in `~/.local/bin`.
- **No LLM key required:** `services/agent-server/agent_server/graph.py` is a reference responder (echoes turn state), so no OpenAI/Anthropic key is needed. LangSmith tracing is optional; keep `LANGSMITH_TRACING=false` locally (root `.env`, which is gitignored). `langgraph.json` reads env from `../../.env`.
- **Web env fallback:** Next.js only reads env from `apps/web`, so the root `.env` `NEXT_PUBLIC_*` vars are not auto-loaded; the web hook falls back to `ws://<host>:3002` for SpacetimeDB, which is correct when browsing via `localhost:3100`.
- **Worker auth is automatic:** the worker self-registers via the `login` + `register_worker` reducers using `AGENT_USERNAME`/`AGENT_PASSWORD`; no manual account seeding is needed.
- **Generated bindings are committed** under `packages/spacetimedb-bindings/generated/`. Only re-run `pnpm coordinator:build` (rebuilds the wasm module and regenerates bindings) after changing the Rust schema in `coordinator/spacetimedb/`.
- **Known pre-existing test issues (unrelated to setup):** `pnpm test:all` (`pnpm -r test`) fails early because `packages/spacetimedb-bindings` has a `test` script but no test files — run the real suites per package instead. The optional `services/api` suite has a test importing a removed `src/coordinator/spacetime-coordinator.js`; the API is a health-only service and is not on the advisor critical path.

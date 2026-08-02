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

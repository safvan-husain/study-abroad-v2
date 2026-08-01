# Coordinator Data Policy

MongoDB owns the durable user-visible transcript. The API is the only browser-facing message boundary and message writes are idempotent by message, conversation, turn, and idempotency key.

SpacetimeDB owns only compact coordination records: job status, leases, attempts, access facts, conversation/turn IDs, Agent Server thread/run IDs, and bounded result summaries. It must never contain message content, a full transcript, credentials, or Agent Server checkpoints. The coordinator also exposes a compact host catalog record for future access-controlled shared references; it is not a transcript or content store.

The Rust module is built with the SpacetimeDB CLI. TypeScript bindings are generated from that module into `packages/spacetimedb-bindings/generated`; the generated directory is reproducible and must not be hand-edited. Run `pnpm spacetime:generate` after schema changes and `pnpm --filter @study-abroad/spacetimedb-bindings generate:check` to verify freshness.

For a live smoke test, publish or target a local database and run `SPACETIME_URL=http://localhost:3000 SPACETIME_DATABASE=study-abroad-coordinator SPACETIME_PUBLISH=true pnpm coordinator:smoke`. Without `SPACETIME_URL`, the command exits successfully with an explicit skip rather than claiming that a live coordinator was verified.

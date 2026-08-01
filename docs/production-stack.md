# Production Compose stack

Run the complete local production topology with:

```sh
docker compose -f docker-compose.production.yml up --build
```

The web UI is at `http://localhost:3000`, the API health endpoint is at
`http://localhost:3001/health`, and the agent server is only reachable inside
the Compose network. Browser API calls use same-origin `/api` and Next.js
rewrites them to `api:3001`; no browser build contains a host API URL.

Set LangSmith values in a local `.env` when tracing is needed. Never commit
`.env`. Stop with `docker compose -f docker-compose.production.yml down` and
reset persistent MongoDB/SpacetimeDB data with the same command plus `-v`.

The agent image currently uses LangGraph's non-reload in-memory server. It is a
containerized development/runtime boundary, not a claim of durable LangGraph
hosting; durable checkpoints require the licensed production server and its
external runtime services.

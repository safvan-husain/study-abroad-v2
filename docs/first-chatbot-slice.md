# First Chatbot Slice

The browser reads and writes messages only through NestJS. The API authorizes the conversation, appends the user message idempotently to MongoDB, and asks the coordinator to enqueue a turn. The worker reads the durable transcript, invokes Agent Server, appends the assistant message, and completes the compact coordinator record. The browser polls the coordinator-owned status boundary and reloads MongoDB history after completion.

Conversation, turn, and correlation identifiers cross each boundary; transcript content stays in MongoDB. Neither the browser nor API imports LangGraph, Agent Server, or worker code.

The local `pnpm end-to-end:smoke` command exercises the same ordering and correlation contract with fakes. The worker remains the only application process allowed to invoke Agent Server; deployment and Study Abroad domain work are deferred.

For local runtime validation, keep the browser, API, and coordinator on separate ports: web `3100`, API `3101`, and a dedicated SpacetimeDB instance on `3010`. This avoids collisions with the older Study Abroad stack, which commonly occupies `3000` and `3001`. Start the coordinator and publish the module to the configured database, then start `pnpm agent:dev`, `pnpm dev:api`, `pnpm dev:worker`, and `pnpm dev:web` before sending a browser message:

```sh
spacetimedb-standalone start --listen-addr 127.0.0.1:3010 --non-interactive
spacetime publish study-abroad-coordinator --server http://127.0.0.1:3010 --module-path coordinator/spacetimedb --anonymous --yes
```

The production Compose topology keeps its internal ports at web `3000`, API `3001`, and SpacetimeDB `3000` because those services have isolated network namespaces.

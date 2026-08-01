# AI worker lifecycle

The AI worker is the only application process allowed to invoke Agent Server. A coordinator subscription (with polling recovery) delivers a pending `chat_turn`; the worker deduplicates the turn, claims a lease, and renews it while processing. It reads the authoritative ordered transcript from MongoDB, invokes the configured graph through the Agent Server HTTP SDK using the conversation ID as `thread_id`, and carries `conversationId`, `turnId`, `correlationId`, `threadId`, and `runId` through the operation.

The assistant message is written idempotently to MongoDB before the worker calls the coordinator completion reducer. Agent failures produce bounded retry/failure results; coordinator rows never contain the transcript or a graph checkpoint. A restart can reclaim an expired lease, and idempotent message writes prevent duplicate assistant messages.

The host constructs `SpacetimeCoordinatorAdapter` with the generated `DbConnection` and an explicit `PendingJobSource`. That source owns the generated `connection.db.job` subscription callback and pending-row polling (tests inject an in-memory source); the worker does not claim a connection is subscribed when no source is supplied. Reducer absence is an error, not a successful no-op.

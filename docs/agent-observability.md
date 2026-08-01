# Agent Server observability boundary

The active and only Agent Server graph runtime is Python under `services/agent-server`. The earlier TypeScript graph spike was removed after the runtime decision; future workers communicate with the Python graph only through Agent Server HTTP.

Phase 1 proves the graph and Agent Server boundary before application databases or worker infrastructure are introduced. The Python graph is deterministic on purpose: each run appends a native AI message, and the second run on the same thread returns the accumulated human/AI message state.

## Root environment

Copy `.env.example` to `.env` at the repository root. Every Phase 1 process reads that file; no package-local `.env` file is supported. The Agent Server loads the same path through `services/agent-server/langgraph.json`, and the smoke script loads it from the repository root based on its own location.

`SMOKE_TEST_GRAPH_ID` selects which registered graph the smoke test invokes. It is smoke-test-only configuration; the application chooses graph IDs at call time.

When `LANGSMITH_TRACING=true`, every run receives the LangSmith-reserved `thread_id` metadata key. The value is the same UUIDv7 used to create the Agent Server thread. The smoke test queries that ID through LangSmith, verifies both root runs are grouped together, and verifies the graph's child runs carry the same thread metadata. Set `LANGSMITH_TRACING=false` to skip LangSmith verification and report `external_trace=not_configured`.

The Agent Server thread and the LangSmith thread are related but separate concerns. Agent Server owns graph state and checkpoints; LangSmith groups traces only when every relevant run has `metadata.thread_id`. A LangSmith thread can reconstruct the trace chart and the inputs/outputs that were recorded for each run, but it does not replace Agent Server state. The conversational graph records the ordered message list and assistant message in each run so a complete multi-turn thread can be inspected.

## Commands

Install the workspace and create the lockfile:

```sh
pnpm install
```

Run the Python local development Agent Server from one terminal:

```sh
pnpm agent:dev
```

Run the observability smoke from another terminal:

```sh
pnpm agent:smoke
```

The smoke creates a UUIDv7 thread, executes the configured graph twice through the Agent Server SDK, captures both run IDs, reads the final thread state, prints correlation metadata, and verifies LangSmith thread reconstruction when `LANGSMITH_TRACING=true`. It does not import or execute the graph directly.

Run the multi-turn chat smoke against the same local Agent Server:

```sh
pnpm agent:chat:smoke
```

It creates/reuses one stable conversation/thread, sends two sequential native `human` turns over HTTP, and verifies accumulated native `human`/`ai` messages, distinct run IDs, and stable `metadata.thread_id`. The TypeScript client never imports the Python graph.

Clone and verify a traced LangSmith chat thread against the local Agent Server:

```sh
pnpm agent:clone-thread -- --thread <langsmith-thread-id>
```

The clone smoke builds the expected transcript and per-turn message checkpoints from the LangSmith root runs, creates the local thread, then reads `threads.get`, `threads.getState`, and `threads.getHistory`. It fails if any message, checkpoint, source turn count, or clone provenance field differs. A successful result prints verification counts and the Agent Studio URL; the URL is only a UI inspection surface after the Agent Server state check passes.

The Python graph is validated with `pnpm agent:python:test` and the HTTP smoke once `pnpm agent:dev` is running. There is no TypeScript graph package: the TypeScript code in this repository is only an Agent Server HTTP client and test harness.

## Expected evidence

The output includes one thread ID, two different root run IDs, one correlation ID shared by the thread's runs, child run IDs returned from LangSmith, and deterministic results equivalent to:

```text
first_output={"messages":[{"type":"human","content":"local-observability"},{"type":"ai","content":"Reference response for turn 1: local-observability"}]}
second_output={"messages":[{"type":"human","content":"local-observability"},{"type":"ai","content":"Reference response for turn 1: local-observability"},{"type":"human","content":"local-observability"},{"type":"ai","content":"Reference response for turn 2: local-observability"}]}
external_thread_run_ids=["<root-run-1>","<root-run-2>","<child-run-1>","<child-run-2>","..."]
external_trace=verified
```

When `LANGSMITH_TRACING=false`, the last line is `external_trace=not_configured` instead.

With tracing enabled, `external_trace=verified` means LangSmith's thread list contains the printed `thread_id`, both Agent Server root runs are returned by `readThread`, child runs are returned too, and `metadata.thread_id` is present on every returned run. This is the automated proof that the whole trace chart is grouped under one LangSmith thread; the UI confirmation is to open the project's Threads tab and select the printed `agent_server_thread_id`.

The local thread and run IDs are always required for this phase. LangSmith is an optional external observability sink; it is not the graph host, application database, or source of truth for the local runtime.

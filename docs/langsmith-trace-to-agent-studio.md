# Why a LangSmith trace can be empty in Agent Studio

## The issue

LangSmith and Agent Studio do not read the same storage.

- **LangSmith** stores execution traces: runs, inputs, outputs, timing, metadata, and the trace hierarchy.
- **The Agent Server** stores runnable thread state: checkpoints, messages, current graph state, and history.
- **Agent Studio** reads thread state from the Agent Server selected by its `baseUrl`. It does not load thread state from LangSmith.

Therefore, seeing a complete trace in LangSmith does not prove that the selected Agent Server still contains a runnable thread with the same ID.

`View Original Thread` is a link to an Agent Studio thread ID. It is not an import or replay operation. Studio will show no data when the linked Agent Server cannot return checkpoints for that ID.

## Common reasons it is empty

The original Agent Server was restarted and used in-memory storage, so its checkpoints disappeared while the separately stored LangSmith traces remained.

Studio may also be connected to a different Agent Server instance, port, graph, or environment from the one that executed the trace. Reusing the same `thread_id` against another server does not recreate its history.

Another failure is treating `metadata.thread_id` as the thread itself. The metadata value groups related LangSmith runs, but it cannot manufacture Agent Server messages or checkpoints.

Finally, the browser must be able to reach the Agent Server. The in-app browser can block localhost even when `curl` reports that the server is healthy. A tunneled server must also have its exact hostname added to Studio's allowed-domain list.

## Requirements for direct `View Original Thread`

All of these must remain true:

1. The trace was executed through an Agent Server thread, not only traced as an isolated graph/function call.
2. The run used the actual Agent Server thread ID for LangSmith correlation.
3. That exact Agent Server instance still contains the thread's checkpoints and messages.
4. Studio connects to that instance through the correct `baseUrl` and graph.

## Persistent VPS development server without a purchased domain

For the complete reproducible HTTPS setup, exact VPS environment values,
LangSmith/Studio connection fields, and the enforced custom-header security
design, see [VPS Agent Server HTTPS and Agent Studio connection](./vps-agent-server-studio.md).

The production Compose stack keeps the development Agent Server state in the
named `agent-server-state` volume. Caddy exposes the API over HTTPS at
`https://agent.200-141-7-99.sslip.io`; `sslip.io` resolves the embedded VPS IP,
so no purchased domain or DNS account is required. Caddy obtains and renews the
TLS certificate automatically.

`AGENT_SERVER_PUBLIC_URL` is passed to both the Agent Server and worker as
`LANGGRAPH_API_URL`. The worker adds it to each run's trace metadata. This makes
new LangSmith traces point their original-thread Studio link at the public VPS
server rather than Docker's private `http://agent-server:2024` address.

This remains a development server exposed to the public internet. It is useful
for a low-cost Studio workflow, but it has no production authentication or
availability guarantee. If the VPS IP changes, update both
`AGENT_SERVER_HOSTNAME` and `AGENT_SERVER_PUBLIC_URL`.
5. The browser can reach the server.

For durable direct links, the Agent Server needs persistent checkpoint storage. A local in-memory development server loses the original thread when it stops.

## Requirement for reconstructing a lost thread

If LangSmith has the traces but the original Agent Server state is gone, the thread must be replayed into a running, compatible Agent Server.

A valid reconstruction requires:

- ordered root runs for every conversational turn;
- structured message lists in each root run's inputs and outputs;
- root inputs replayed as `__start__` state updates;
- child node outputs replayed in source superstep order;
- node names that exist in the target graph; and
- semantic message verification plus checkpoint-history verification after creation.

Replaying only the `thread_id`, or creating an empty thread with that ID, is insufficient. Replaying child-node outputs without root inputs also drops human messages.

The target graph must remain state-compatible with the traced graph. If nodes or state fields changed, the trace may need migration rather than direct replay.

## Project workflow

Start the current Python Agent Server:

```sh
pnpm agent:dev
```

If Studio's browser cannot reach localhost, use the supported HTTPS tunnel:

```sh
pnpm agent:dev:tunnel
```

Add the printed temporary hostname to Studio's allowed-domain list. The hostname changes when a quick tunnel restarts.

Clone and verify the LangSmith thread against that same server:

```sh
pnpm agent:clone-thread -- \
  --thread <LANGSMITH_THREAD_ID> \
  --project study-abroad-v2-agents \
  --agent-url <AGENT_SERVER_OR_TUNNEL_URL> \
  --organization <LANGSMITH_ORGANIZATION_ID>
```

Use the `studioUrl` printed by the command. It points to the newly reconstructed Agent Server thread, which may have a different ID from the LangSmith source thread.

The command succeeds only after it verifies the message count, every reconstructed checkpoint, final state, source-turn count, and clone provenance. Its implementation is `scripts/clone-langsmith-thread.ts`.

## Diagnostic rule

If LangSmith shows the trace but Studio is empty, first query the selected Agent Server for that thread's state and history. If they are absent, this is a missing Agent Server checkpoint problem, not a LangSmith tracing problem. Reconnect to the original persistent server or reconstruct the thread from the trace.

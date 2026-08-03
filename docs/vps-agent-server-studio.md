# VPS Agent Server HTTPS and Agent Studio connection

This project exposes the development Agent Server from the VPS without a
purchased domain. It uses `sslip.io` for DNS and Caddy for HTTPS.

## Current connection values

| Setting | Value |
| --- | --- |
| VPS public IP | `200.141.7.99` |
| Agent Server hostname | `agent.200-141-7-99.sslip.io` |
| Agent Server base URL | `https://agent.200-141-7-99.sslip.io` |
| Health URL | `https://agent.200-141-7-99.sslip.io/ok` |
| LangSmith organization ID | `7e3ada7c-95b0-4e0f-8317-d0c92af8ad14` |
| LangSmith project | `study-abroad-v2-agents` |
| LangSmith project ID | `ef41ae1a-f4dc-4ca8-8a18-f6035175deed` |
| LangGraph graph ID | `agent` |
| Studio allowed domain | `agent.200-141-7-99.sslip.io` |

The hostname embeds the VPS IP with hyphens. `sslip.io` resolves it to
`200.141.7.99`, so there is no DNS account or purchased domain to configure.

## VPS environment

Set these values in `/root/study-abroad-v2/.env` on the VPS:

```dotenv
AGENT_SERVER_HOSTNAME=agent.200-141-7-99.sslip.io
AGENT_SERVER_PUBLIC_URL=https://agent.200-141-7-99.sslip.io
AGENT_SERVER_ACCESS_TOKEN=<LONG_RANDOM_SECRET>

LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_PROJECT=study-abroad-v2-agents
LANGSMITH_API_KEY=<LANGSMITH_API_KEY>
```

Never commit the real `LANGSMITH_API_KEY`.

Deploy or rebuild the stack:

```sh
ssh topad
cd /root/study-abroad-v2
git pull --ff-only
set -a
. ./.env
set +a
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
curl -fsS \
  -H "X-Agent-Server-Token: $AGENT_SERVER_ACCESS_TOKEN" \
  https://agent.200-141-7-99.sslip.io/ok
```

The VPS firewall and hosting provider must allow inbound TCP ports `80` and
`443`. Port `2024` is intentionally not published. Caddy is the only public
entry point and proxies HTTPS requests to `agent-server:2024` on Docker's
private network.

## How HTTPS is created

The `agent-server-proxy` service in `docker-compose.production.yml` publishes
ports `80` and `443`. Its Caddyfile contains:

```caddyfile
{$AGENT_SERVER_HOSTNAME} {
	encode zstd gzip
	reverse_proxy agent-server:2024
}
```

Caddy resolves the hostname, obtains a public TLS certificate, renews it, and
stores its state in the persistent `agent-server-caddy-data` and
`agent-server-caddy-config` Docker volumes. The explicit public DNS resolvers
on the Caddy container avoid the VPS host-only resolver problem encountered
during the initial certificate request.

The Agent Server checkpoints and messages are separate from Caddy. They are
stored in the persistent `agent-server-state` volume mounted at
`/app/.langgraph_api`.

If the VPS IP changes, create the new `sslip.io` hostname and update both
`AGENT_SERVER_HOSTNAME` and `AGENT_SERVER_PUBLIC_URL` before rebuilding.

## Connect Agent Studio directly

In LangSmith, open **Studio**, then **Connect to a server** or
**Configure connection**. Enter:

```text
Base URL: https://agent.200-141-7-99.sslip.io
Allowed Domain: agent.200-141-7-99.sslip.io
Custom Header name: X-Agent-Server-Token
Custom Header value: <AGENT_SERVER_ACCESS_TOKEN_FROM_THE_VPS_ENV_FILE>
```

If Studio reports **Domain not allowed**:

1. Open **Configure connection**.
2. Select **Add to allowed domains**.
3. Confirm `agent.200-141-7-99.sslip.io`.
4. Save, connect, and select the `agent` graph if Studio asks.

Allowed domains and custom-header values are stored locally in that browser.
Each teammate or new browser profile must configure them once.

## Open a LangSmith trace in Studio

New worker traces contain these metadata values:

```text
LANGGRAPH_API_URL=https://agent.200-141-7-99.sslip.io
thread_id=<THE_ACTUAL_AGENT_SERVER_THREAD_ID>
```

In the `study-abroad-v2-agents` LangSmith project:

1. Open **Tracing**, then **Threads**.
2. Select the thread.
3. Open the thread actions menu.
4. Select **View original thread**.

Studio should open with the public VPS base URL and the same thread ID. If it
opens an expired tunnel such as `*.lhr.life` or `*.trycloudflare.com`, open
**Configure connection**, replace the stale Base URL with the current value
above, and retry **View original thread**.

This works only while the persistent VPS Agent Server still contains that
thread. LangSmith stores the trace but does not store the Agent Server's
runnable checkpoints.

## Custom-header protection

The public endpoint requires a random custom header. Caddy validates it before
proxying requests to the Agent Server. Merely entering a header in Studio would
not provide protection without this server-side validation.

Use a dedicated header such as:

```text
Header name: X-Agent-Server-Token
Header value: <LONG_RANDOM_SECRET>
```

The intended request path is:

```text
Agent Studio browser -> HTTPS -> Caddy validates header -> Agent Server
```

The secret lives only in `AGENT_SERVER_ACCESS_TOKEN` in the VPS `.env` and the
authorized user's Studio connection settings. It must not be committed, placed
in trace metadata, or added to `AGENT_SERVER_PUBLIC_URL`.

Caddy allows unauthenticated `OPTIONS` requests to reach the Agent Server so
browser CORS preflight continues to work, while requiring the token on actual
API requests. The internal worker keeps using `http://agent-server:2024`; it
does not pass through the public Caddy proxy and does not need the token.

Every browser that uses Studio must configure:

```text
Base URL: https://agent.200-141-7-99.sslip.io
Allowed Domain: agent.200-141-7-99.sslip.io
Custom Header name: X-Agent-Server-Token
Custom Header value: <THE_SAME_VPS_SECRET>
```

Treat this as shared-secret development access, not full production identity
or per-user authorization. Rotate the secret if it is exposed or a teammate
should lose access.

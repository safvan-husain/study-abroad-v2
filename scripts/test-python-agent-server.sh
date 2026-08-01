#!/usr/bin/env bash
set -euo pipefail

server_port="${AGENT_TEST_PORT:-2031}"
server_url="http://127.0.0.1:${server_port}"
server_log="${TMPDIR:-/tmp}/study-abroad-python-agent-test.log"

if lsof -nP -iTCP:"${server_port}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Refusing to reuse occupied test port ${server_port}." >&2
  exit 1
fi

uv --directory services/agent-server run langgraph dev \
  --config langgraph.json \
  --host 127.0.0.1 \
  --port "${server_port}" \
  --no-browser \
  --no-reload >"${server_log}" 2>&1 &
server_pid=$!

cleanup() {
  kill "${server_pid}" >/dev/null 2>&1 || true
  wait "${server_pid}" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

for _ in {1..60}; do
  if curl --fail --silent "${server_url}/ok" >/dev/null 2>&1; then
    AGENT_SERVER_URL="${server_url}" pnpm agent:test
    exit 0
  fi
  if ! kill -0 "${server_pid}" >/dev/null 2>&1; then
    cat "${server_log}" >&2
    exit 1
  fi
  sleep 0.25
done

cat "${server_log}" >&2
echo "Python Agent Server did not become ready at ${server_url}." >&2
exit 1

#!/usr/bin/env bash
# Fast-iteration dev stack: SpacetimeDB in Docker, app services on the host with hot reload.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -f "${ROOT}/docker-compose.production.yml")
STATE_DIR="${ROOT}/.dev"
PID_DIR="${STATE_DIR}/pids"
LOG_DIR="${STATE_DIR}/logs"
SPACETIME_VOLUME="study-abroad-production_spacetimedb-advisor-data"

HOST_SERVICES=(agent api worker web)

load_env() {
  if [[ -f "${ROOT}/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "${ROOT}/.env"
    set +a
  fi

  export API_PORT="${API_PORT:-3101}"
  export WEB_PORT="${WEB_PORT:-3100}"
  export SPACETIME_URL="${SPACETIME_URL:-http://localhost:3002}"
  export SPACETIME_DATABASE="${SPACETIME_DATABASE:-study-abroad-coordinator}"
  export NEXT_PUBLIC_SPACETIME_URL="${NEXT_PUBLIC_SPACETIME_URL:-ws://localhost:3002}"
  export NEXT_PUBLIC_SPACETIME_DATABASE="${NEXT_PUBLIC_SPACETIME_DATABASE:-study-abroad-coordinator}"
  export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:${API_PORT}}"
  export AGENT_SERVER_URL="${AGENT_SERVER_URL:-http://localhost:2025}"
  export USE_LIVE_COORDINATOR="${USE_LIVE_COORDINATOR:-true}"
  export WORKER_ID="${WORKER_ID:-local-worker}"
  export WORKER_LEASE_SECONDS="${WORKER_LEASE_SECONDS:-60}"
  export AGENT_GRAPH_ID="${AGENT_GRAPH_ID:-agent}"
}

ensure_dirs() {
  mkdir -p "${PID_DIR}" "${LOG_DIR}"
}

service_port() {
  case "$1" in
    web) echo "${WEB_PORT}" ;;
    api) echo "${API_PORT}" ;;
    agent) echo "${AGENT_SERVER_URL##*:}" ;;
    worker) echo "" ;;
    *) return 1 ;;
  esac
}

port_listener_pids() {
  local port="$1"
  lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true
}

is_service_running() {
  local name="$1"
  local pidfile="${PID_DIR}/${name}.pid"
  if [[ -f "${pidfile}" ]]; then
    local pid
    pid="$(cat "${pidfile}")"
    if kill -0 "${pid}" 2>/dev/null; then
      return 0
    fi
    rm -f "${pidfile}"
  fi
  local port
  port="$(service_port "${name}" || true)"
  [[ -n "${port}" ]] && [[ -n "$(port_listener_pids "${port}")" ]]
}

kill_port() {
  local port="$1"
  local pids
  pids="$(port_listener_pids "${port}")"
  [[ -z "${pids}" ]] && return 0
  kill ${pids} 2>/dev/null || true
  sleep 0.2
  pids="$(port_listener_pids "${port}")"
  [[ -n "${pids}" ]] && kill -9 ${pids} 2>/dev/null || true
}

stop_service() {
  local name="$1"
  local pidfile="${PID_DIR}/${name}.pid"

  if [[ -f "${pidfile}" ]]; then
    local pid
    pid="$(cat "${pidfile}")"
    if kill -0 "${pid}" 2>/dev/null; then
      kill -- "-${pid}" 2>/dev/null || kill "${pid}" 2>/dev/null || true
      wait "${pid}" 2>/dev/null || true
    fi
    rm -f "${pidfile}"
  fi

  local port
  port="$(service_port "${name}" || true)"
  if [[ -n "${port}" ]]; then
    kill_port "${port}"
  fi
}

start_service() {
  local name="$1"
  shift

  ensure_dirs
  stop_service "${name}"

  local logfile="${LOG_DIR}/${name}.log"
  : > "${logfile}"

  (
    cd "${ROOT}"
    load_env
    exec "$@"
  ) >> "${logfile}" 2>&1 &

  local pid=$!
  echo "${pid}" > "${PID_DIR}/${name}.pid"

  local port
  port="$(service_port "${name}" || true)"
  if [[ -n "${port}" ]]; then
    for _ in $(seq 1 120); do
      if [[ -n "$(port_listener_pids "${port}")" ]]; then
        return 0
      fi
      if ! kill -0 "${pid}" 2>/dev/null; then
        echo "${name} exited during startup. Last log lines:" >&2
        tail -n 40 "${logfile}" >&2 || true
        return 1
      fi
      sleep 0.25
    done
    echo "${name} did not bind port ${port} in time. Last log lines:" >&2
    tail -n 40 "${logfile}" >&2 || true
    return 1
  fi

  sleep 0.5
  if ! kill -0 "${pid}" 2>/dev/null; then
    echo "${name} exited during startup. Last log lines:" >&2
    tail -n 40 "${logfile}" >&2 || true
    return 1
  fi
}

start_agent() {
  start_service agent pnpm agent:dev
}

start_api() {
  start_service api pnpm dev:api
}

start_worker() {
  start_service worker pnpm dev:worker
}

start_web() {
  start_service web pnpm dev:web
}

start_all_host_services() {
  start_agent
  start_api
  start_worker
  start_web
}

stop_all_host_services() {
  local name
  for name in "${HOST_SERVICES[@]}"; do
    stop_service "${name}" || true
  done
}

ensure_spacetime() {
  echo "Starting SpacetimeDB (Docker) on host port 3002..."
  "${COMPOSE[@]}" up -d --wait spacetimedb
}

publish_coordinator() {
  echo "Building and publishing coordinator module..."
  "${COMPOSE[@]}" build coordinator-publisher
  "${COMPOSE[@]}" run --rm coordinator-publisher
}

print_urls() {
  load_env
  cat <<EOF

Dev stack is running.

  Web UI:      http://localhost:${WEB_PORT}
  API health:  http://localhost:${API_PORT}/health
  SpacetimeDB: ${SPACETIME_URL}  (browser ws: ${NEXT_PUBLIC_SPACETIME_URL})
  Agent:       ${AGENT_SERVER_URL}

Logs: ${LOG_DIR}/
Stop host services: pnpm dev:stop
Restart one service: pnpm dev:restart:web | dev:restart:api | dev:restart:worker | dev:restart:agent
EOF
}

cmd_up() {
  load_env
  ensure_dirs
  ensure_spacetime
  publish_coordinator
  start_all_host_services
  print_urls
  echo
  echo "Streaming combined logs (Ctrl+C stops host services; SpacetimeDB keeps running)."
  trap 'stop_all_host_services' INT TERM
  tail -n 20 -F "${LOG_DIR}/agent.log" "${LOG_DIR}/api.log" "${LOG_DIR}/worker.log" "${LOG_DIR}/web.log"
}

cmd_down() {
  stop_all_host_services
  if [[ "${1:-}" == "--docker" ]]; then
    echo "Stopping SpacetimeDB container..."
    "${COMPOSE[@]}" stop spacetimedb
  else
    echo "Host services stopped. SpacetimeDB container is still running."
    echo "Stop it too with: pnpm dev:stop:docker"
  fi
}

cmd_restart() {
  local target="${1:-all}"
  load_env
  ensure_dirs

  case "${target}" in
    web)
      stop_service web
      start_web
      ;;
    api)
      stop_service api
      start_api
      ;;
    web-api)
      stop_service web
      stop_service api
      start_api
      start_web
      ;;
    worker)
      stop_service worker
      start_worker
      ;;
    agent)
      stop_service agent
      start_agent
      ;;
    all)
      stop_all_host_services
      start_all_host_services
      ;;
    *)
      echo "Unknown restart target: ${target}" >&2
      echo "Use one of: web, api, web-api, worker, agent, all" >&2
      exit 1
      ;;
  esac

  print_urls
}

cmd_reset_db() {
  echo "Resetting SpacetimeDB data volume..."
  stop_all_host_services
  "${COMPOSE[@]}" stop spacetimedb || true
  docker volume rm "${SPACETIME_VOLUME}" 2>/dev/null || true
  ensure_spacetime
  publish_coordinator
  echo "Database reset and coordinator republished."
  echo "Start host services with: pnpm dev  (or pnpm dev:restart)"
}

cmd_republish() {
  load_env
  ensure_spacetime
  publish_coordinator
  echo "Coordinator republished."
  echo "Restart affected host services if bindings changed: pnpm dev:restart"
}

cmd_status() {
  load_env
  ensure_dirs

  if "${COMPOSE[@]}" ps --status running spacetimedb 2>/dev/null | grep -q spacetimedb; then
    echo "SpacetimeDB (Docker): running on ${SPACETIME_URL}"
  else
    echo "SpacetimeDB (Docker): stopped"
  fi

  local name
  for name in "${HOST_SERVICES[@]}"; do
    if is_service_running "${name}"; then
      local port
      port="$(service_port "${name}" || true)"
      if [[ -n "${port}" ]]; then
        echo "${name}: running (port ${port})"
      else
        echo "${name}: running"
      fi
    else
      echo "${name}: stopped"
    fi
  done
}

usage() {
  cat <<EOF
Usage: bash scripts/dev-stack.sh <command>

Commands:
  up                 Start SpacetimeDB, publish coordinator, run all host dev services
  down               Stop host dev services (SpacetimeDB keeps running)
  down --docker      Stop host services and the SpacetimeDB container
  restart <target>   Restart web | api | web-api | worker | agent | all
  reset-db           Wipe SpacetimeDB data, republish coordinator
  republish          Rebuild and republish coordinator module
  status             Show Docker and host service status
EOF
}

main() {
  local cmd="${1:-}"
  shift || true

  case "${cmd}" in
    up) cmd_up "$@" ;;
    down) cmd_down "$@" ;;
    restart) cmd_restart "$@" ;;
    reset-db) cmd_reset_db "$@" ;;
    republish) cmd_republish "$@" ;;
    status) cmd_status "$@" ;;
    ""|-h|--help|help) usage ;;
    *)
      echo "Unknown command: ${cmd}" >&2
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"

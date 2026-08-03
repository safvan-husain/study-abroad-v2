#!/bin/sh
set -e

SERVER=http://spacetimedb:3000
MODULE=/workspace/coordinator/spacetimedb
NAME=study-abroad-coordinator
CLI=/opt/spacetime/spacetimedb-cli

publish() {
  "$CLI" publish "$NAME" --server "$SERVER" --module-path "$MODULE" --yes --delete-data=on-conflict
}

if ! "$CLI" login show >/dev/null 2>&1; then
  "$CLI" login --server-issued-login "$SERVER"
fi

set +e
PUBLISH_OUTPUT=$(publish 2>&1)
PUBLISH_STATUS=$?
set -e
printf '%s\n' "$PUBLISH_OUTPUT"

if [ "$PUBLISH_STATUS" -eq 0 ]; then
  exit 0
fi

case "$PUBLISH_OUTPUT" in
  *InvalidSignature*)
    "$CLI" logout
    "$CLI" login --server-issued-login "$SERVER"
    exec "$CLI" publish "$NAME" --server "$SERVER" --module-path "$MODULE" --yes --delete-data=on-conflict
    ;;
  *) exit "$PUBLISH_STATUS" ;;
esac

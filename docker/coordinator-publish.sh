#!/bin/sh
set -e

SERVER=http://spacetimedb:3000
MODULE=/workspace/coordinator/spacetimedb
NAME=study-abroad-coordinator
CLI=/opt/spacetime/spacetimedb-cli

if "$CLI" describe "$NAME" --server "$SERVER" --anonymous --json >/dev/null 2>&1; then
  echo "Database $NAME already exists; leaving the published module unchanged."
  exit 0
fi

exec "$CLI" publish "$NAME" --server "$SERVER" --module-path "$MODULE" --anonymous --yes --delete-data=on-conflict

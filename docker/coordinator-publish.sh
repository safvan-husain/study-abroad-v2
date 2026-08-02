#!/bin/sh
set -e

SERVER=http://spacetimedb:3000
MODULE=/workspace/coordinator/spacetimedb
NAME=study-abroad-coordinator
CLI=/opt/spacetime/spacetimedb-cli

if ! "$CLI" login show >/dev/null 2>&1; then
  "$CLI" login --server-issued-login "$SERVER"
fi

exec "$CLI" publish "$NAME" --server "$SERVER" --module-path "$MODULE" --yes --delete-data=on-conflict

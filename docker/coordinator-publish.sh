#!/bin/sh
set -e

SERVER=http://spacetimedb:3000
MODULE=/workspace/coordinator/spacetimedb
NAME=study-abroad-coordinator
CLI=/opt/spacetime/spacetimedb-cli

"$CLI" delete "$NAME" --server "$SERVER" --anonymous --yes 2>/dev/null || true
exec "$CLI" publish "$NAME" --server "$SERVER" --module-path "$MODULE" --anonymous --yes --delete-data=on-conflict

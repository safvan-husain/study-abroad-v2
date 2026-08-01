#!/bin/sh
set -e

DATA_DIR=/home/spacetime/data
KEY_DIR="$DATA_DIR/keys"

mkdir -p "$DATA_DIR" "$KEY_DIR" /home/spacetime/.config/spacetime
chown -R spacetime:spacetime "$DATA_DIR" /home/spacetime/.config

if [ ! -f "$KEY_DIR/id_ecdsa" ]; then
  openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:prime256v1 -out "$KEY_DIR/id_ecdsa"
  openssl pkey -in "$KEY_DIR/id_ecdsa" -pubout -out "$KEY_DIR/id_ecdsa.pub"
  chown spacetime:spacetime "$KEY_DIR/id_ecdsa" "$KEY_DIR/id_ecdsa.pub"
  chmod 600 "$KEY_DIR/id_ecdsa"
  chmod 644 "$KEY_DIR/id_ecdsa.pub"
fi

exec runuser -u spacetime -- /opt/spacetime/spacetimedb-standalone start \
  --listen-addr 0.0.0.0:3000 \
  --data-dir "$DATA_DIR" \
  --jwt-priv-key-path "$KEY_DIR/id_ecdsa" \
  --jwt-pub-key-path "$KEY_DIR/id_ecdsa.pub" \
  --non-interactive

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/openwa-gateway/.openwa.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "OpenWA no está corriendo (sin PID file)"
  exit 0
fi

PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID" 2>/dev/null || true
  echo "OpenWA detenido (PID $PID)"
else
  echo "Proceso $PID ya no existe"
fi

rm -f "$PID_FILE"

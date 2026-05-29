#!/usr/bin/env bash
# Reinicia OpenWA si la API no responde (útil en cron o manual).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if curl -sf http://127.0.0.1:2785/api/health >/dev/null 2>&1; then
  echo "OpenWA OK"
  exit 0
fi

echo "OpenWA no responde — reiniciando..."
"$ROOT_DIR/scripts/stop-openwa.sh" || true
"$ROOT_DIR/scripts/setup-openwa.sh"
"$ROOT_DIR/scripts/register-webhook.sh"
echo "OpenWA reiniciado."

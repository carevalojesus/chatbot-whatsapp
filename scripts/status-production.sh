#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> OpenWA"
if curl -sf http://127.0.0.1:2785/api/health >/dev/null 2>&1; then
  echo "    OK — http://127.0.0.1:2785"
else
  echo "    NO RESPONDE — ejecuta ./scripts/setup-openwa.sh"
fi

echo "==> Bot"
if curl -sf http://127.0.0.1:3000/health >/dev/null 2>&1; then
  curl -s http://127.0.0.1:3000/health | python3 -m json.tool 2>/dev/null || curl -s http://127.0.0.1:3000/health
else
  echo "    NO RESPONDE — ejecuta ./scripts/start-production.sh"
fi

echo "==> PM2"
if command -v pm2 >/dev/null 2>&1; then
  pm2 list 2>/dev/null || true
else
  echo "    PM2 no instalado"
fi

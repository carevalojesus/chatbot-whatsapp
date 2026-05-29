#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if command -v pm2 >/dev/null 2>&1; then
  pm2 stop chatbot-bot 2>/dev/null || true
  echo "Bot detenido (PM2)"
else
  echo "PM2 no instalado — detén el proceso del bot manualmente si corre."
fi

"$ROOT_DIR/scripts/stop-openwa.sh"

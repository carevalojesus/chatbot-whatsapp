#!/usr/bin/env bash
# Levanta OpenWA + bot en modo producción (PM2).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

chmod +x scripts/*.sh 2>/dev/null || true
mkdir -p logs

echo "==> 1/4 OpenWA"
./scripts/setup-openwa.sh

echo "==> 2/4 Webhook"
./scripts/register-webhook.sh

echo "==> 3/4 Compilar bot"
cd "$ROOT_DIR/bot"
npm run build

echo "==> 4/4 Iniciar bot con PM2"
cd "$ROOT_DIR"

if ! command -v pm2 >/dev/null 2>&1; then
  echo ""
  echo "PM2 no está instalado. Instálalo con:"
  echo "  npm install -g pm2"
  echo ""
  echo "Iniciando bot en primer plano (sin PM2)..."
  cd bot && exec npm start
fi

pm2 describe chatbot-bot >/dev/null 2>&1 && pm2 restart chatbot-bot || pm2 start ecosystem.config.cjs
pm2 save 2>/dev/null || true

echo ""
echo "==> Producción lista"
echo "    Bot:    pm2 logs chatbot-bot"
echo "    Health: curl http://127.0.0.1:3000/health"
echo "    Parar:  ./scripts/stop-production.sh"

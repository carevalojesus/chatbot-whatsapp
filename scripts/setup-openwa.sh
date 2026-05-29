#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENWA_DIR="$ROOT_DIR/openwa-gateway"
API_KEY_FILE="$OPENWA_DIR/data/.api-key"
PID_FILE="$OPENWA_DIR/.openwa.pid"
LOG_FILE="$OPENWA_DIR/openwa.log"
ENV_FILE="$ROOT_DIR/.env"

echo "==> OpenWA en modo LOCAL (sin Docker)"
echo "    (Docker falla con mirrors Debian 403 en muchas redes)"

if [ ! -d "$OPENWA_DIR" ]; then
  echo "==> Clonando OpenWA..."
  git clone --depth 1 https://github.com/rmyndharis/OpenWA.git "$OPENWA_DIR"
fi

cd "$OPENWA_DIR"
mkdir -p data/sessions data/media

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "==> OpenWA ya está corriendo (PID $(cat "$PID_FILE"))"
else
  echo "==> Instalando dependencias (solo API, sin dashboard)..."
  npm install --ignore-scripts
  npm install sqlite3
  npm rebuild sqlite3

  echo "==> Instalando Chrome para Puppeteer (requerido por WhatsApp)..."
  npx puppeteer browsers install chrome

  echo "==> Iniciando OpenWA API..."
  NODE_ENV=development \
  PORT=2785 \
  DATABASE_TYPE=sqlite \
  DATABASE_NAME=./data/openwa.sqlite \
  DATABASE_SYNCHRONIZE=true \
  ENGINE_TYPE=whatsapp-web.js \
  SESSION_DATA_PATH=./data/sessions \
  PUPPETEER_HEADLESS=true \
  STORAGE_TYPE=local \
  STORAGE_LOCAL_PATH=./data/media \
  nohup npm run start:dev > "$LOG_FILE" 2>&1 &

  echo $! > "$PID_FILE"
  echo "    PID: $(cat "$PID_FILE")"
  echo "    Log: $LOG_FILE"
fi

echo "==> Esperando API..."
for i in $(seq 1 90); do
  if curl -sf http://localhost:2785/api/health >/dev/null 2>&1; then
    echo "    API lista en ${i}s"
    break
  fi
  if [ "$i" -eq 90 ]; then
    echo "ERROR: OpenWA no respondió. Últimas líneas del log:"
    tail -30 "$LOG_FILE" || true
    exit 1
  fi
  sleep 2
done

API_KEY="dev-admin-key"
if [ -f "$API_KEY_FILE" ]; then
  API_KEY="$(tr -d '[:space:]' < "$API_KEY_FILE")"
fi

if [ ! -f "$ENV_FILE" ]; then
  cp "$ROOT_DIR/.env.example" "$ENV_FILE"
fi

# Modo local: webhook apunta a localhost (no host.docker.internal)
if grep -q '^OPENWA_WEBHOOK_URL=' "$ENV_FILE"; then
  sed -i '' 's|^OPENWA_WEBHOOK_URL=.*|OPENWA_WEBHOOK_URL=http://127.0.0.1:3000/webhook|' "$ENV_FILE"
else
  echo "OPENWA_WEBHOOK_URL=http://127.0.0.1:3000/webhook" >> "$ENV_FILE"
fi

if grep -q '^OPENWA_API_KEY=' "$ENV_FILE"; then
  sed -i '' "s|^OPENWA_API_KEY=.*|OPENWA_API_KEY=$API_KEY|" "$ENV_FILE"
else
  echo "OPENWA_API_KEY=$API_KEY" >> "$ENV_FILE"
fi

echo ""
echo "OpenWA corriendo en local:"
echo "  API:     http://localhost:2785/api"
echo "  Swagger: http://localhost:2785/api/docs"
echo "  API Key: $API_KEY"
echo ""
echo "Siguiente paso:"
echo "  ./scripts/register-webhook.sh"
echo "  ./scripts/show-qr.sh"
echo "  cd bot && npm install && npm run dev"
echo ""
echo "Para detener OpenWA: ./scripts/stop-openwa.sh"

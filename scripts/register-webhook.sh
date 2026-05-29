#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  cp "$ROOT_DIR/.env.example" "$ENV_FILE"
  echo "Se creó .env desde .env.example. Configura OPENWA_API_KEY y vuelve a ejecutar."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [ -z "${OPENWA_API_KEY:-}" ]; then
  echo "ERROR: OPENWA_API_KEY está vacío en .env"
  echo "Obtén la key en http://localhost:2886"
  exit 1
fi

OPENWA_URL="${OPENWA_URL:-http://localhost:2785}"
SESSION_NAME="${OPENWA_SESSION_NAME:-restaurante}"
WEBHOOK_URL="${OPENWA_WEBHOOK_URL:-http://host.docker.internal:3000/webhook}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-cambia-este-secreto}"

echo "==> Esperando API de OpenWA en $OPENWA_URL"
for _ in $(seq 1 30); do
  if curl -sf "$OPENWA_URL/api/health" >/dev/null; then
    break
  fi
  sleep 2
done

echo "==> Creando sesión '$SESSION_NAME' si no existe"
curl -sf -X POST "$OPENWA_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $OPENWA_API_KEY" \
  -d "{\"name\":\"$SESSION_NAME\"}" >/dev/null || true

echo "==> Iniciando sesión (escanea el QR en el dashboard)"
curl -sf -X POST "$OPENWA_URL/api/sessions/$SESSION_NAME/start" \
  -H "X-API-Key: $OPENWA_API_KEY" >/dev/null || true

echo "==> Registrando webhook -> $WEBHOOK_URL"
curl -sf -X POST "$OPENWA_URL/api/sessions/$SESSION_NAME/webhooks" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $OPENWA_API_KEY" \
  -d "{
    \"url\": \"$WEBHOOK_URL\",
    \"events\": [\"message.received\"],
    \"secret\": \"$WEBHOOK_SECRET\"
  }" >/dev/null || echo "(webhook ya existía o hubo un aviso — revisa el dashboard)"

echo ""
echo "Listo. Abre http://localhost:2886 y escanea el QR."
echo "Luego inicia el bot con: cd bot && npm run dev"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
# shellcheck source=lib/openwa-env.sh
source "$ROOT_DIR/scripts/lib/openwa-env.sh"

if [ ! -f "$ENV_FILE" ]; then
  cp "$ROOT_DIR/.env.example" "$ENV_FILE"
fi

OPENWA_API_KEY="$(resolve_openwa_api_key "$ROOT_DIR" "$ENV_FILE")"
OPENWA_URL="$(read_env "$ENV_FILE" OPENWA_URL "http://localhost:2785")"
SESSION_NAME="$(read_env "$ENV_FILE" OPENWA_SESSION_NAME "restaurante")"
WEBHOOK_URL="$(read_env "$ENV_FILE" OPENWA_WEBHOOK_URL "http://127.0.0.1:3000/webhook")"
WEBHOOK_SECRET="$(read_env "$ENV_FILE" WEBHOOK_SECRET "cambia-este-secreto")"

echo "==> Esperando API de OpenWA en $OPENWA_URL"
for _ in $(seq 1 30); do
  if curl -sf "$OPENWA_URL/api/health" >/dev/null; then
    break
  fi
  sleep 2
done

echo "==> Creando sesión '$SESSION_NAME' si no existe"
SESSION_ID="$(ensure_session "$OPENWA_URL" "$OPENWA_API_KEY" "$SESSION_NAME")"
echo "    Session ID: $SESSION_ID"

set_env_value "$ENV_FILE" OPENWA_SESSION_ID "$SESSION_ID"
set_env_value "$ENV_FILE" OPENWA_API_KEY "$OPENWA_API_KEY"

echo "==> Iniciando sesión..."
curl -sf -X POST "$OPENWA_URL/api/sessions/$SESSION_ID/start" \
  -H "X-API-Key: $OPENWA_API_KEY" >/dev/null || echo "    (sesión ya iniciada)"

echo "==> Limpiando webhooks duplicados..."
EXISTING="$(curl -sf "$OPENWA_URL/api/sessions/$SESSION_ID/webhooks" \
  -H "X-API-Key: $OPENWA_API_KEY" || echo "[]")"

echo "$EXISTING" | node -e "
const webhooks = JSON.parse(require('fs').readFileSync(0, 'utf8'));
for (const wh of webhooks) {
  console.log(wh.id);
}
" | while read -r WH_ID; do
  [ -n "$WH_ID" ] || continue
  curl -sf -X DELETE "$OPENWA_URL/api/sessions/$SESSION_ID/webhooks/$WH_ID" \
    -H "X-API-Key: $OPENWA_API_KEY" >/dev/null || true
  echo "    Eliminado webhook $WH_ID"
done

echo "==> Registrando webhook -> $WEBHOOK_URL"
REGISTER_RESULT="$(curl -s -w "\n%{http_code}" -X POST "$OPENWA_URL/api/sessions/$SESSION_ID/webhooks" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $OPENWA_API_KEY" \
  -d "{
    \"url\": \"$WEBHOOK_URL\",
    \"events\": [\"message.received\"],
    \"secret\": \"$WEBHOOK_SECRET\"
  }")"

HTTP_CODE="$(echo "$REGISTER_RESULT" | tail -1)"
BODY="$(echo "$REGISTER_RESULT" | sed '$d')"

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "    Webhook registrado OK"
elif echo "$BODY" | grep -qi "already exists\|duplicate"; then
  echo "    Webhook ya existía — OK"
else
  echo "ERROR registrando webhook (HTTP $HTTP_CODE):"
  echo "$BODY"
  exit 1
fi

set_env_value "$ENV_FILE" OPENWA_WEBHOOK_URL "$WEBHOOK_URL"

echo ""
echo "Listo. Siguiente:"
echo "  ./scripts/show-qr.sh     # conectar WhatsApp"
echo "  cd bot && npm run dev    # iniciar el bot"

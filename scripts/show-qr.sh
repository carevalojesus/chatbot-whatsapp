#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
QR_FILE="$ROOT_DIR/qr-whatsapp.png"
OPENWA_DIR="$ROOT_DIR/openwa-gateway"
# shellcheck source=lib/openwa-env.sh
source "$ROOT_DIR/scripts/lib/openwa-env.sh"

if [ ! -f "$ENV_FILE" ]; then
  cp "$ROOT_DIR/.env.example" "$ENV_FILE"
fi

OPENWA_API_KEY="$(resolve_openwa_api_key "$ROOT_DIR" "$ENV_FILE")"
OPENWA_URL="$(read_env "$ENV_FILE" OPENWA_URL "http://localhost:2785")"
SESSION_NAME="$(read_env "$ENV_FILE" OPENWA_SESSION_NAME "restaurante")"
SESSION_ID="$(read_env "$ENV_FILE" OPENWA_SESSION_ID "")"

if [ -z "$SESSION_ID" ]; then
  SESSION_ID="$(ensure_session "$OPENWA_URL" "$OPENWA_API_KEY" "$SESSION_NAME")"
  set_env_value "$ENV_FILE" OPENWA_SESSION_ID "$SESSION_ID"
fi

echo "==> Sesión: $SESSION_NAME"
echo "    ID: $SESSION_ID"

STATUS="$(curl -sf "$OPENWA_URL/api/sessions/$SESSION_ID" \
  -H "X-API-Key: $OPENWA_API_KEY" | node -e "
const s = JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log(s.status);
")"

echo "    Estado actual: $STATUS"

if [ "$STATUS" = "failed" ] || [ "$STATUS" = "disconnected" ]; then
  echo "==> Reiniciando sesión..."
  curl -sf -X POST "$OPENWA_URL/api/sessions/$SESSION_ID/stop" \
    -H "X-API-Key: $OPENWA_API_KEY" >/dev/null 2>&1 || true
  sleep 2
fi

echo "==> Iniciando sesión (abre Chrome en segundo plano)..."
START_RESPONSE="$(curl -s -X POST "$OPENWA_URL/api/sessions/$SESSION_ID/start" \
  -H "X-API-Key: $OPENWA_API_KEY")"

if echo "$START_RESPONSE" | grep -qi "Could not find Chrome"; then
  echo ""
  echo "ERROR: Falta Chrome para Puppeteer. Ejecuta:"
  echo "  cd openwa-gateway && npx puppeteer browsers install chrome"
  echo "  ./scripts/show-qr.sh"
  exit 1
fi

echo "==> Esperando QR (30-60 segundos)..."
RESPONSE=""
for i in $(seq 1 45); do
  RESPONSE="$(curl -s "$OPENWA_URL/api/sessions/$SESSION_ID/qr" \
    -H "X-API-Key: $OPENWA_API_KEY")"

  if echo "$RESPONSE" | grep -q '"qrCode"'; then
    echo "    QR listo (${i} intentos)"
    break
  fi

  if echo "$RESPONSE" | grep -qi 'already authenticated'; then
    echo ""
    echo "✅ WhatsApp ya está conectado. No necesitas escanear QR."
    exit 0
  fi

  if echo "$RESPONSE" | grep -qi 'Could not find Chrome'; then
    echo ""
    echo "ERROR: Instala Chrome con:"
    echo "  cd openwa-gateway && npx puppeteer browsers install chrome"
    exit 1
  fi

  sleep 2
done

node -e "
const data = JSON.parse(process.argv[1]);
const qr = data?.qrCode;
if (!qr) {
  console.error('No se obtuvo QR. Respuesta de OpenWA:');
  console.error(JSON.stringify(data, null, 2));
  console.error('');
  console.error('Revisa: tail -50 openwa-gateway/openwa.log');
  process.exit(1);
}
const base64 = qr.replace(/^data:image\\/\\w+;base64,/, '');
require('fs').writeFileSync(process.argv[2], Buffer.from(base64, 'base64'));
console.log('');
console.log('✅ QR guardado en: ' + process.argv[2]);
console.log('   WhatsApp → Dispositivos vinculados → Vincular dispositivo');
" "$RESPONSE" "$QR_FILE"

open "$QR_FILE" 2>/dev/null || echo "Abre manualmente: $QR_FILE"

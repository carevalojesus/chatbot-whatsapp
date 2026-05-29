#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENWA_DIR="$ROOT_DIR/openwa-gateway"

echo "==> Preparando OpenWA en $OPENWA_DIR"

if [ ! -d "$OPENWA_DIR" ]; then
  git clone --depth 1 https://github.com/rmyndharis/OpenWA.git "$OPENWA_DIR"
fi

cd "$OPENWA_DIR"
docker compose -f docker-compose.dev.yml up -d --build

echo ""
echo "OpenWA levantado:"
echo "  Dashboard: http://localhost:2886"
echo "  API:       http://localhost:2785/api"
echo "  Swagger:   http://localhost:2785/api/docs"
echo ""
echo "Siguiente paso:"
echo "  1. Abre el dashboard y copia tu API Key"
echo "  2. Pégala en .env como OPENWA_API_KEY"
echo "  3. Ejecuta: ./scripts/register-webhook.sh"
echo "  4. Escanea el QR de la sesión 'restaurante'"
echo "  5. Inicia el bot: cd bot && npm install && npm run dev"

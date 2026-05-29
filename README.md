# Chatbot WhatsApp — Restaurante

Bot de pedidos para restaurante conectado a WhatsApp vía [OpenWA](https://www.open-wa.org/).

## Qué hace

- Muestra la carta del restaurante
- Guía al cliente para armar un pedido paso a paso
- Soporta domicilio o recoger en local
- Registra pedidos (en memoria por ahora; Firebase en fase 2)
- Consulta de estado de pedidos

## Requisitos

- Node.js 20+
- Git
- Google Chrome (para Puppeteer / OpenWA)

## Inicio rápido

### 1. Configurar variables

```bash
cp .env.example .env
# Edita .env con tu API key y secret de webhook
```

### 2. Levantar OpenWA (local)

```bash
chmod +x scripts/*.sh
./scripts/setup-openwa.sh
```

OpenWA corre en segundo plano en `http://localhost:2785`. Logs en `openwa-gateway/openwa.log`.

### 3. Registrar webhook y conectar WhatsApp

```bash
./scripts/register-webhook.sh
./scripts/show-qr.sh
```

Escanea el QR que se guarda en `qr-whatsapp.png` con WhatsApp.

### 4. Iniciar el bot

```bash
cd bot
npm install
npm run dev
```

El bot escucha en http://127.0.0.1:3000/webhook

### 5. Probar

Envía **Hola** desde **otro teléfono** (no desde el WhatsApp vinculado al bot).

## Comandos útiles

| Script | Descripción |
|---|---|
| `./scripts/setup-openwa.sh` | Instala y levanta OpenWA |
| `./scripts/register-webhook.sh` | Registra el webhook del bot |
| `./scripts/show-qr.sh` | Muestra QR para vincular WhatsApp |
| `./scripts/stop-openwa.sh` | Detiene OpenWA |

## Flujo del bot

```
Hola → Menú principal
  1 → Ver carta
  2 → Hacer pedido → categorías → platos → cantidad → listo → domicilio/recoger → confirmar
  3 → Estado del pedido
  4 → Ayuda
```

Comandos globales: `hola`, `menu`, `cancelar`

## Personalizar

| Archivo | Qué cambiar |
|---|---|
| `.env` | Nombre del restaurante, costo domicilio, API key |
| `bot/src/menu/menu.json` | Carta (categorías, platos, precios) |

## Estructura

```
chatbot-whatsapp/
├── bot/                 # Backend Node.js + TypeScript
│   └── src/
│       ├── flows/       # Lógica del chatbot
│       ├── menu/        # Carta JSON
│       ├── orders/      # Almacén de pedidos (temporal)
│       ├── session/     # Estado por usuario
│       ├── webhook/     # Receptor + deduplicación
│       └── openwa/      # Cliente API OpenWA
├── scripts/             # Setup OpenWA + webhook
└── openwa-gateway/      # Clon de OpenWA (generado por setup, gitignored)
```

## Próximos pasos

- [ ] Conectar Firebase Firestore para carta y pedidos
- [ ] Notificar al restaurante cuando llega un pedido
- [ ] Integrar IA para preguntas libres
- [ ] Panel web para gestionar pedidos

## Notas

- OpenWA usa WhatsApp Web (no oficial). Usa un número dedicado.
- Los pedidos se pierden al reiniciar el bot (hasta conectar Firebase).
- El webhook debe usar `127.0.0.1`, no `localhost` (OpenWA lo rechaza).

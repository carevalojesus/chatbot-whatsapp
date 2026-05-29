# Chatbot WhatsApp — Restaurante

Bot de pedidos para restaurante conectado a WhatsApp vía [OpenWA](https://www.open-wa.org/).

## Qué hace

- Muestra la carta del restaurante
- Guía al cliente para armar un pedido paso a paso
- Soporta domicilio o recoger en local
- Registra pedidos (en memoria por ahora; Firebase en fase 2)
- Consulta de estado de pedidos

## Requisitos

- Docker Desktop
- Node.js 20+
- Git

## Inicio rápido

### 1. Levantar OpenWA

```bash
chmod +x scripts/*.sh
./scripts/setup-openwa.sh
```

### 2. Configurar variables

```bash
cp .env.example .env
```

Edita `.env` y pega tu `OPENWA_API_KEY` desde http://localhost:2886

### 3. Registrar webhook y sesión

```bash
./scripts/register-webhook.sh
```

Escanea el QR en el dashboard con WhatsApp.

### 4. Iniciar el bot

```bash
cd bot
npm install
npm run dev
```

El bot escucha en http://localhost:3000/webhook

### 5. Probar

Envía **Hola** al número de WhatsApp conectado.

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
│       └── openwa/      # Cliente API OpenWA
├── scripts/             # Setup OpenWA + webhook
├── docker-compose.yml   # Bot en Docker (opcional)
└── openwa-gateway/      # Clon de OpenWA (generado por setup)
```

## Bot en Docker (opcional)

```bash
docker compose up -d --build
```

Asegúrate de que `OPENWA_WEBHOOK_URL=http://host.docker.internal:3000/webhook` en `.env`.

## Próximos pasos

- [ ] Conectar Firebase Firestore para carta y pedidos
- [ ] Notificar al restaurante cuando llega un pedido
- [ ] Integrar IA para preguntas libres
- [ ] Panel web para gestionar pedidos

## Notas

- OpenWA usa WhatsApp Web (no oficial). Usa un número dedicado.
- Los pedidos se pierden al reiniciar el bot (hasta conectar Firebase).

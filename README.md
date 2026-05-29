# Chatbot WhatsApp — La Curva del Paraíso

Bot de pedidos para cevichería peruana conectado a WhatsApp vía [OpenWA](https://www.open-wa.org/) y **Firebase Firestore**.

## Qué hace

- Muestra la carta (ceviches, tiraditos, entradas, bebidas, etc.)
- Guía al cliente para armar un pedido paso a paso
- Domicilio o recoger en local
- Guarda pedidos, carta y sesiones en Firestore
- Notifica al admin por WhatsApp cuando llega un pedido
- **Comandos admin** para gestionar pedidos desde WhatsApp
- Consulta de estado de pedidos y **cancelación** (cliente y admin)
- **Comprobante PDF con QR** al confirmar pedido (validación de entrega)
- **Perfil de cliente** con nombre y direcciones guardadas (Casa, Trabajo, etc.)

## Requisitos

- Node.js 20+
- Git
- Google Chrome (Puppeteer / OpenWA)
- Proyecto Firebase con **Firestore** activado
- Firebase CLI (opcional, para reglas): `npm install -g firebase-tools`

---

## Pasos de instalación (orden completo)

### 1. Clonar e instalar

```bash
git clone git@github.com:carevalojesus/chatbot-whatsapp.git
cd chatbot-whatsapp
cp .env.example .env
cd bot && npm install && cd ..
```

### 2. Firebase

1. [Firebase Console](https://console.firebase.google.com/) → **Project settings** → **Service accounts**
2. **Generate new private key** → guardar como `firebase-service-account.json` en la **raíz del repo**
3. Verificar `.env`:

```env
FIREBASE_SERVICE_ACCOUNT=./firebase-service-account.json
FIREBASE_PROJECT_ID=chatbot-restaurante-40e94
RESTAURANT_NAME="La Curva del Paraíso"
RESTAURANT_ID=la-curva-del-paraiso
RESTAURANT_ADMIN_PHONE=933240664
DELIVERY_FEE=8
```

4. Activar **Firestore** en la consola
5. Desplegar reglas e índices:

```bash
firebase login
firebase deploy --only firestore:rules,firestore:indexes --project chatbot-restaurante-40e94
```

6. Cargar restaurante y carta en Firestore:

```bash
cd bot
npm run seed:firebase
```

### 3. OpenWA (WhatsApp)

```bash
chmod +x scripts/*.sh
./scripts/setup-openwa.sh
./scripts/register-webhook.sh
./scripts/show-qr.sh
```

Escanea el QR (`qr-whatsapp.png`) con el WhatsApp del **negocio** (número dedicado al bot).

### 4. Iniciar el bot

```bash
cd bot
npm run dev
```

Verificar:

```bash
curl http://127.0.0.1:3000/health
# debe mostrar: "firebase": true, "restaurant": "La Curva del Paraíso"
```

### 5. Probar el chatbot

| ✅ Correcto | ❌ Incorrecto |
|------------|--------------|
| Enviar desde **otro celular** al número del bot | Enviar desde el WhatsApp vinculado al bot |
| Escribir `Hola` y esperar 3–5 s | Repetir `Hola` muchas veces seguidas |

**Flujo de prueba manual:**

```
Hola  → menú principal
1     → carta completa
2     → iniciar pedido
1     → categoría Ceviches
1     → ceviche de pescado
1     → cantidad
listo → continuar
2     → recoger en local
si    → confirmar pedido
```

**Prueba automática** (envía mensajes al admin en WhatsApp):

```bash
cd bot
npm run test:chatbot
```

---

## Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `./scripts/setup-openwa.sh` | Instala y levanta OpenWA |
| `./scripts/register-webhook.sh` | Registra webhook (limpia duplicados) |
| `./scripts/show-qr.sh` | QR para vincular WhatsApp |
| `./scripts/stop-openwa.sh` | Detiene OpenWA |
| `npm run dev` | Bot en desarrollo |
| `npm run seed:firebase` | Sincroniza carta y datos del restaurante |
| `npm run test:chatbot` | Prueba end-to-end y envía al admin |

---

## Firebase — estructura

```
restaurants/
  la-curva-del-paraiso/                    # Perfil (nombre, admin, horario, domicilio)
  la-curva-del-paraiso/menu/current        # Carta (41 platos, 8 categorías)
  la-curva-del-paraiso/orders/{id}         # Pedidos (#1001, #1002, …)
  la-curva-del-paraiso/sessions/{id}       # Sesión del chat (carrito en curso)
  la-curva-del-paraiso/customers/{id}      # Clientes (nombre, contador de pedidos)
  la-curva-del-paraiso/customers/{id}/addresses/{id}  # Direcciones guardadas
  la-curva-del-paraiso/customerChats/{id}  # Índice chatId → customerId
  la-curva-del-paraiso/meta/counters       # Contador de pedidos
```

### Comandos admin (WhatsApp)

Desde el número admin (`933240664`) escribe al bot:

| Comando | Acción |
|---------|--------|
| `/pedidos` | Ver pedidos pendientes |
| `/ver 1001` | Detalle de un pedido |
| `/confirmar 1001` | En preparación + avisa al cliente |
| `/listo 1001` | Entregado + avisa al cliente |
| `/cancelar 1001` | Cancela pedido pendiente + avisa al cliente |
| `/validar 1001` | Valida entrega (QR) + marca entregado + avisa al cliente |
| `/ayuda` | Lista de comandos |

Al confirmar un pedido, el cliente y el admin reciben un **PDF** con detalle del pedido y un **código QR**. El admin valida escaneando el QR o con `/validar 1001` (también acepta pegar el código `LCP:1001:...` del QR).

### Menú del cliente

| Opción | Acción |
|--------|--------|
| **3 — Mis pedidos** | Ver pedidos recientes; cancelar si están *pendientes* |
| **4 — Mi perfil** | Editar nombre, agregar/eliminar direcciones (máx. 5) |

Al pedir domicilio, el bot ofrece direcciones guardadas o permite ingresar una nueva y guardarla con alias.

### Cambiar estado manualmente (Firebase Console)

En Firestore → `orders` → pedido → campo `status`:

| Valor | Significado |
|-------|-------------|
| `pendiente` | Recién llegado |
| `confirmado` | En preparación |
| `entregado` | Completado |
| `cancelado` | Cancelado (cliente o admin) |

El cliente consulta con la opción **3** del bot.

---

## Personalizar

| Dónde | Qué cambiar |
|-------|-------------|
| `.env` | Nombre, domicilio, teléfono admin |
| `bot/src/menu/menu.json` | Carta base (luego `npm run seed:firebase`) |
| Firebase `menu/current` | Carta en producción sin redeploy |

---

## Estructura del proyecto

```
chatbot-whatsapp/
├── bot/src/
│   ├── flows/          # Lógica del chatbot (pedidos, perfil, admin)
│   ├── customers/      # Clientes y direcciones guardadas
│   ├── firebase/       # Admin SDK
│   ├── menu/           # Carta + Firestore
│   ├── orders/         # Pedidos (Firestore / memoria)
│   ├── session/        # Sesiones de chat
│   ├── restaurant/     # Perfil del negocio
│   ├── notifications/  # Aviso al admin
│   └── webhook/        # Receptor + deduplicación
├── scripts/            # OpenWA setup
├── firebase.json       # Config Firebase CLI
├── firestore.rules     # Reglas de seguridad
└── openwa-gateway/     # OpenWA local (gitignored)
```

---

## Modo sin Firebase

Si no hay `firebase-service-account.json`, el bot usa **memoria local** (pedidos se pierden al reiniciar).

---

## Solución de problemas

| Problema | Solución |
|----------|----------|
| No responde a `Hola` | Verifica que el bot corre (`npm run dev`) y OpenWA está `ready` |
| Responde una vez y luego no | Reinicia el bot; no envíes el mismo mensaje en ráfaga |
| Webhook no llega | Ejecuta `./scripts/register-webhook.sh` de nuevo |
| `firebase: false` en `/health` | Revisa ruta del JSON y `FIREBASE_PROJECT_ID` en `.env` |
| QR no conecta | `./scripts/show-qr.sh` y escanea de nuevo |

---

## Próximos pasos

- [x] Comandos admin por WhatsApp (`/confirmar`, `/listo`, `/cancelar`)
- [x] Perfil de cliente y direcciones guardadas
- [x] Comprobante PDF con QR y validación `/validar`
- [ ] Panel web para gestionar pedidos
- [ ] IA para preguntas libres

## Notas

- OpenWA usa WhatsApp Web (no oficial). Usa un número dedicado al negocio.
- El admin (`933240664`) recibe WhatsApp con cada pedido nuevo.
- El webhook debe usar `127.0.0.1`, no `localhost`.
- **Nunca subas** `firebase-service-account.json` ni `.env` a GitHub.

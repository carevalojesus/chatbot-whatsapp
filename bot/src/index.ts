import express from "express";
import { config } from "./config.js";
import { initFirebase, isFirebaseEnabled } from "./firebase/admin.js";
import { loadMenu } from "./menu/data.js";
import { loadRestaurantProfile } from "./restaurant/profile.js";
import { handleWebhook, logWebhookReady } from "./webhook/handler.js";
import { startIdleSessionWatcher } from "./session/idleWatcher.js";

const app = express();

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    restaurant: config.restaurant.name,
    openwaConfigured: Boolean(config.openwa.apiKey),
    sessionId: config.openwa.sessionId || null,
    firebase: isFirebaseEnabled(),
  });
});

app.post(
  "/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req, res) => {
    try {
      const rawBody =
        req.body instanceof Buffer
          ? req.body.toString("utf8")
          : String(req.body ?? "");
      const signature = req.headers["x-openwa-signature"] as
        | string
        | undefined;
      const idempotencyHeader = req.headers["x-openwa-idempotency-key"] as
        | string
        | undefined;
      const deliveryIdHeader = req.headers["x-openwa-delivery-id"] as
        | string
        | undefined;

      const result = await handleWebhook(
        rawBody,
        signature,
        idempotencyHeader,
        deliveryIdHeader,
      );
      res.status(result.status).send(result.body);
    } catch (error) {
      console.error("Error procesando webhook:", error);
      res.status(500).send("Error interno");
    }
  },
);

async function bootstrap(): Promise<void> {
  if (isFirebaseEnabled()) {
    await initFirebase();
    await loadRestaurantProfile();
    await loadMenu();
    console.log("Firebase: conectado");
    console.log(`Admin WhatsApp: ${config.restaurant.adminWhatsAppId}`);
  } else {
    await loadMenu();
    console.log("Firebase: desactivado (modo memoria)");
  }

  app.listen(config.port, () => {
    logWebhookReady();
    startIdleSessionWatcher();
    console.log(`API Key configurada: ${config.openwa.apiKey ? "sí" : "no"}`);
  });
}

bootstrap().catch((error) => {
  console.error("Error al iniciar el bot:", error);
  process.exit(1);
});

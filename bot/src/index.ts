import express from "express";
import { config } from "./config.js";
import { handleWebhook, logWebhookReady } from "./webhook/handler.js";

const app = express();

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    restaurant: config.restaurantName,
    openwaConfigured: Boolean(config.openwa.apiKey),
    sessionId: config.openwa.sessionId || null,
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

      const result = await handleWebhook(
        rawBody,
        signature,
        idempotencyHeader,
      );
      res.status(result.status).send(result.body);
    } catch (error) {
      console.error("Error procesando webhook:", error);
      res.status(500).send("Error interno");
    }
  },
);

app.listen(config.port, () => {
  logWebhookReady();
  console.log(`API Key configurada: ${config.openwa.apiKey ? "sí" : "no"}`);
});

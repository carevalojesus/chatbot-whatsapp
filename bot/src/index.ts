import express from "express";
import { config } from "./config.js";
import { handleWebhook, logWebhookReady } from "./webhook/handler.js";

const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    restaurant: config.restaurantName,
    openwaConfigured: Boolean(config.openwa.apiKey),
  });
});

app.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-openwa-signature"] as string | undefined;
    const result = await handleWebhook(req.body, signature);
    res.status(result.status).send(result.body);
  } catch (error) {
    console.error("Error procesando webhook:", error);
    res.status(500).send("Error interno");
  }
});

app.listen(config.port, () => {
  logWebhookReady();
});

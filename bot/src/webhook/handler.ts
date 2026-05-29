import { config } from "../config.js";
import { eventKey, isDuplicateBurst, isDuplicateEvent } from "./dedupe.js";
import { handleIncomingMessage } from "../flows/orderFlow.js";
import { sendTextMessage } from "../openwa/client.js";
import { verifyWebhookSignature } from "./verify.js";

export interface MessageReceivedPayload {
  event: "message.received";
  sessionId: string;
  timestamp: string;
  idempotencyKey?: string;
  data: {
    id: string;
    from: string;
    to: string;
    body: string;
    type: string;
    fromMe?: boolean;
    isGroup?: boolean;
    contact?: {
      name?: string;
      pushName?: string;
    };
  };
}

export async function handleWebhook(
  rawBody: string,
  signature: string | undefined,
  idempotencyHeader?: string,
): Promise<{ status: number; body: string }> {
  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("Webhook rechazado: firma inválida");
    return { status: 401, body: "Firma inválida" };
  }

  let payload: Partial<MessageReceivedPayload>;
  try {
    payload = JSON.parse(rawBody) as Partial<MessageReceivedPayload>;
  } catch {
    return { status: 400, body: "JSON inválido" };
  }

  if (payload.event !== "message.received" || !payload.data) {
    return { status: 200, body: "OK" };
  }

  const { data } = payload;

  if (data.isGroup || data.fromMe) {
    return { status: 200, body: "OK" };
  }

  const text = data.body?.trim();
  if (!text) {
    return { status: 200, body: "OK" };
  }

  const dedupeKey = eventKey(
    idempotencyHeader ?? payload.idempotencyKey,
    data.id,
    data.from,
    text,
  );

  if (isDuplicateEvent(dedupeKey)) {
    console.log(`Mensaje duplicado ignorado (${dedupeKey})`);
    return { status: 200, body: "OK" };
  }

  if (isDuplicateBurst(text)) {
    console.log(`Mensaje duplicado ignorado (burst: "${text}")`);
    return { status: 200, body: "OK" };
  }

  console.log(`Mensaje de ${data.from}: "${text}"`);

  const customerName = data.contact?.pushName ?? data.contact?.name;
  const reply = handleIncomingMessage(data.from, text, customerName);

  if (reply) {
    await sendTextMessage(data.from, reply);
    console.log(`Respuesta enviada a ${data.from}`);
  }

  return { status: 200, body: "OK" };
}

export function logWebhookReady(): void {
  console.log(`Webhook activo en http://127.0.0.1:${config.port}/webhook`);
  console.log(`Restaurante: ${config.restaurantName}`);
}

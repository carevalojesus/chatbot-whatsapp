import { config } from "../config.js";
import { handleIncomingMessage } from "../flows/orderFlow.js";
import { sendTextMessage } from "../openwa/client.js";
import { verifyWebhookSignature } from "./verify.js";

export interface MessageReceivedPayload {
  event: "message.received";
  sessionId: string;
  timestamp: string;
  data: {
    id: string;
    from: string;
    to: string;
    body: string;
    type: string;
    isGroup?: boolean;
    fromMe?: boolean;
    contact?: {
      name?: string;
      pushName?: string;
    };
  };
}

export async function handleWebhook(
  payload: unknown,
  signature: string | undefined,
): Promise<{ status: number; body: string }> {
  if (!verifyWebhookSignature(payload, signature)) {
    return { status: 401, body: "Firma inválida" };
  }

  const event = payload as Partial<MessageReceivedPayload>;
  if (event.event !== "message.received" || !event.data) {
    return { status: 200, body: "OK" };
  }

  const { data } = event;

  if (data.isGroup || data.fromMe) {
    return { status: 200, body: "OK" };
  }

  const text = data.body?.trim();
  if (!text) {
    return { status: 200, body: "OK" };
  }

  const customerName = data.contact?.pushName ?? data.contact?.name;
  const reply = handleIncomingMessage(data.from, text, customerName);

  if (reply) {
    await sendTextMessage(data.from, reply);
  }

  return { status: 200, body: "OK" };
}

export function logWebhookReady(): void {
  console.log(`Webhook activo en http://localhost:${config.port}/webhook`);
  console.log(`Restaurante: ${config.restaurantName}`);
}

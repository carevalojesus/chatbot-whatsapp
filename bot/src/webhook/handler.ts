import { config } from "../config.js";
import { getRestaurantName } from "../restaurant/profile.js";
import {
  eventKey,
  isDuplicateBurst,
  isDuplicateCrossChannel,
  isDuplicateEvent,
} from "./dedupe.js";
import { handleAdminCommand, getAdminHelpText, isExplicitAdminCommand } from "../flows/adminFlow.js";
import {
  formatNonTextReply,
  handleIncomingMedia,
  handleIncomingMessage,
} from "../flows/orderFlow.js";
import { sendTextMessage } from "../openwa/client.js";
import { isAdminChatId, rememberAdminChatId } from "../restaurant/profile.js";
import { verifyWebhookSignature } from "./verify.js";

export interface MessageReceivedPayload {
  event: "message.received";
  sessionId: string;
  timestamp: string;
  deliveryId?: string;
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

const MEDIA_TYPES = new Set([
  "image",
  "document",
  "audio",
  "ptt",
  "video",
  "sticker",
  "location",
  "vcard",
  "contact",
]);

export async function handleWebhook(
  rawBody: string,
  signature: string | undefined,
  idempotencyHeader?: string,
  deliveryIdHeader?: string,
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

  const messageType = (data.type ?? "chat").toLowerCase();
  const text = data.body?.trim() ?? "";
  const customerName = data.contact?.pushName ?? data.contact?.name;

  if (!text && !MEDIA_TYPES.has(messageType)) {
    return { status: 200, body: "OK" };
  }

  const dedupeKey = eventKey(
    idempotencyHeader ?? payload.idempotencyKey,
    deliveryIdHeader ?? payload.deliveryId,
    data.id,
    data.from,
    text || `[${messageType}]`,
  );

  if (isDuplicateEvent(dedupeKey)) {
    console.log(`Mensaje duplicado ignorado (${dedupeKey})`);
    return { status: 200, body: "OK" };
  }

  if (text && isDuplicateCrossChannel(text)) {
    console.log(`Mensaje duplicado ignorado (cross: "${text}")`);
    return { status: 200, body: "OK" };
  }

  if (text && isDuplicateBurst(data.from, text)) {
    console.log(`Mensaje duplicado ignorado (burst: "${text}")`);
    return { status: 200, body: "OK" };
  }

  console.log(
    `Mensaje de ${data.from} (${messageType}): "${text || "[media]"}"`,
  );

  if (isAdminChatId(data.from)) {
    rememberAdminChatId(data.from);

    if (text && isExplicitAdminCommand(text)) {
      const adminResult = await handleAdminCommand(text, data.from);
      if (adminResult) {
        await sendTextMessage(data.from, adminResult.reply);
        console.log(`Comando admin procesado para ${data.from}`);

        if (adminResult.customerNotification) {
          const { chatId, text: customerText } = adminResult.customerNotification;
          await sendTextMessage(chatId, customerText);
          console.log(`Cliente notificado (${chatId})`);
        }

        return { status: 200, body: "OK" };
      }

      if (text.trim().startsWith("/")) {
        await sendTextMessage(data.from, getAdminHelpText());
        console.log(`Ayuda admin enviada a ${data.from}`);
        return { status: 200, body: "OK" };
      }
    }
  } else if (text && isExplicitAdminCommand(text)) {
    console.warn(`Comando admin no autorizado desde ${data.from}`);
    await sendTextMessage(
      data.from,
      "⚠️ Este número no está autorizado como admin.\n\nAgrega tu ID de chat en RESTAURANT_ADMIN_CHAT_IDS en .env",
    );
    return { status: 200, body: "OK" };
  }

  let reply: string;

  if (
    !text &&
    (messageType === "image" || messageType === "document")
  ) {
    reply = await handleIncomingMedia(data.from, messageType, customerName);
  } else if (!text && MEDIA_TYPES.has(messageType)) {
    reply = formatNonTextReply(messageType);
  } else if (text) {
    reply = await handleIncomingMessage(data.from, text, customerName);
  } else {
    return { status: 200, body: "OK" };
  }

  if (reply) {
    try {
      await sendTextMessage(data.from, reply);
      console.log(`Respuesta enviada a ${data.from}`);
    } catch (error) {
      console.error(`No se pudo enviar respuesta a ${data.from}:`, error);
      return { status: 200, body: "OK" };
    }
  }

  return { status: 200, body: "OK" };
}

export function logWebhookReady(): void {
  console.log(`Webhook activo en http://127.0.0.1:${config.port}/webhook`);
  console.log(`Restaurante: ${getRestaurantName()}`);
}

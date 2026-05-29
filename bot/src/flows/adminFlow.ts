import {
  cancelOrder,
  getOrder,
  getOrderByValidationToken,
  getPendingOrders,
  updateOrderStatus,
  validateOrder,
  type Order,
} from "../orders/index.js";
import { formatPaymentDetail } from "../orders/payment.js";
import { getRestaurantName } from "../restaurant/profile.js";
import { formatCurrency } from "../utils/format.js";
import { normalizeText } from "../utils/format.js";

export interface AdminCommandResult {
  reply: string;
  customerNotification?: {
    chatId: string;
    text: string;
  };
}

function helpText(): string {
  return `🔐 *Comandos admin — ${getRestaurantName()}*

/pedidos — Ver pedidos pendientes
/confirmar [número] — Marcar en preparación y avisar al cliente
/listo [número] — Marcar entregado y avisar al cliente
/cancelar [número] — Cancelar pedido pendiente y avisar al cliente
/validar [número|token] — Validar entrega con QR (marca entregado)
/ver [número] — Ver detalle de un pedido
/ayuda — Mostrar esta ayuda

Ejemplos:
  /pedidos
  /confirmar 1001
  /listo 1001
  /cancelar 1001
  /validar 1001`;
}

export function getAdminHelpText(): string {
  return helpText();
}

export function isAdminCommandText(text: string): boolean {
  return isExplicitAdminCommand(text);
}

/** Solo comandos admin inequívocos (con / o número de pedido). */
export function isExplicitAdminCommand(text: string): boolean {
  const trimmed = text.trim();
  const normalized = normalizeText(trimmed);

  if (trimmed.startsWith("/")) {
    return parseAdminCommand(text) !== null;
  }

  if (["ayuda", "help", "admin", "pedidos"].includes(normalized)) {
    return true;
  }

  return /^(confirmar|listo|entregado|cancelar|ver|validar)\s+/.test(normalized);
}

export async function handleAdminCommand(
  text: string,
  adminChatId?: string,
): Promise<AdminCommandResult | null> {
  const parsed = parseAdminCommand(text);
  if (!parsed) {
    return null;
  }

  switch (parsed.command) {
    case "ayuda":
      return { reply: helpText() };
    case "pedidos":
      return { reply: await formatPendingOrders() };
    case "ver":
      return handleViewOrder(parsed.orderId);
    case "confirmar":
      return handleStatusChange(parsed.orderId, "confirmado");
    case "listo":
      return handleStatusChange(parsed.orderId, "entregado");
    case "cancelar":
      return handleCancelOrder(parsed.orderId);
    case "validar":
      return handleValidateOrder(
        parsed.orderId,
        parsed.validationToken,
        adminChatId,
      );
    default:
      return { reply: helpText() };
  }
}

type AdminCommand =
  | "pedidos"
  | "confirmar"
  | "listo"
  | "cancelar"
  | "validar"
  | "ver"
  | "ayuda";

function parseAdminCommand(text: string): {
  command: AdminCommand;
  orderId?: string;
  validationToken?: string;
} | null {
  const trimmed = text.trim();
  const normalized = normalizeText(trimmed);

  if (
    normalized === "ayuda" ||
    normalized === "help" ||
    normalized === "admin"
  ) {
    return { command: "ayuda" };
  }

  const withSlash = trimmed.match(
    /^\/(pedidos|confirmar|listo|entregado|cancelar|validar|ver|ayuda)(?:\s+(.+))?$/i,
  );
  if (withSlash) {
    const cmd = withSlash[1].toLowerCase();
    const arg = withSlash[2]?.trim();
    if (cmd === "validar") {
      return arg ? mapValidarArg(arg) : { command: "ayuda" };
    }
    return mapCommand(cmd, arg);
  }

  if (normalized === "pedidos") {
    return { command: "pedidos" };
  }

  const withOrderId = normalized.match(
    /^(confirmar|listo|entregado|cancelar|ver)\s+#?(\d+)$/,
  );
  if (withOrderId) {
    return mapCommand(withOrderId[1], withOrderId[2]);
  }

  const validarMatch = normalized.match(/^validar\s+(.+)$/);
  if (validarMatch) {
    return mapValidarArg(validarMatch[1].trim());
  }

  return null;
}

function mapValidarArg(arg: string): {
  command: AdminCommand;
  orderId?: string;
  validationToken?: string;
} {
  const orderMatch = arg.match(/^#?(\d+)$/);
  if (orderMatch) {
    return { command: "validar", orderId: orderMatch[1] };
  }

  const qrMatch = arg.match(/^LCP:(\d+):([a-f0-9]+)$/i);
  if (qrMatch) {
    return {
      command: "validar",
      orderId: qrMatch[1],
      validationToken: qrMatch[2],
    };
  }

  if (/^[a-f0-9]{32}$/i.test(arg)) {
    return { command: "validar", validationToken: arg };
  }

  return { command: "ayuda" };
}

function mapCommand(
  raw: string,
  orderId?: string,
): { command: AdminCommand; orderId?: string; validationToken?: string } | null {
  const cmd = raw.toLowerCase();

  if (cmd === "pedidos") {
    return { command: "pedidos" };
  }

  if (cmd === "ayuda") {
    return { command: "ayuda" };
  }

  if (!orderId) {
    return { command: "ayuda" };
  }

  if (cmd === "confirmar") {
    return { command: "confirmar", orderId };
  }

  if (cmd === "listo" || cmd === "entregado") {
    return { command: "listo", orderId };
  }

  if (cmd === "cancelar") {
    return { command: "cancelar", orderId };
  }

  if (cmd === "validar") {
    return orderId ? { command: "validar", orderId } : { command: "ayuda" };
  }

  if (cmd === "ver") {
    return { command: "ver", orderId };
  }

  return null;
}

async function formatPendingOrders(): Promise<string> {
  const orders = await getPendingOrders();

  if (!orders.length) {
    return "✅ No hay pedidos pendientes.";
  }

  const lines = [`📋 *Pedidos pendientes (${orders.length})*\n`];

  orders.forEach((order) => {
    lines.push(formatOrderLine(order));
  });

  lines.push("\nUsa */confirmar*, */listo* o */cancelar* con el número de pedido");
  return lines.join("\n");
}

function formatOrderLine(order: Order): string {
  const customer = order.customerName ? ` — ${order.customerName}` : "";
  const mode =
    order.deliveryType === "domicilio" ? "🛵 domicilio" : "🏪 recoger";
  return `#${order.id}${customer} — ${formatCurrency(order.total)} — ${mode}`;
}

async function handleViewOrder(
  orderId?: string,
): Promise<AdminCommandResult> {
  if (!orderId) {
    return { reply: "Indica el número: */ver 1001*" };
  }

  const order = await getOrder(orderId);
  if (!order) {
    return { reply: `❌ Pedido #${orderId} no encontrado.` };
  }

  const items = order.items
    .map(
      (item) =>
        `• ${item.quantity}x ${item.name} — ${formatCurrency(item.unitPrice * item.quantity)}`,
    )
    .join("\n");

  const delivery =
    order.deliveryType === "domicilio"
      ? `📍 ${order.address}`
      : "🏪 Recoger en local";

  const payment = order.paymentMethod
    ? formatPaymentDetail(order.paymentMethod, order.cashPaid, order.changeDue)
    : "—";

  return {
    reply: `📦 *Pedido #${order.id}*
Estado: ${order.status}
Cliente: ${order.customerName ?? "—"}
${delivery}
Pago: ${payment}

${items}

Total: *${formatCurrency(order.total)}*`,
  };
}

async function handleStatusChange(
  orderId: string | undefined,
  status: "confirmado" | "entregado",
): Promise<AdminCommandResult> {
  if (!orderId) {
    const example = status === "confirmado" ? "/confirmar 1001" : "/listo 1001";
    return { reply: `Indica el número: *${example}*` };
  }

  const existing = await getOrder(orderId);
  if (!existing) {
    return { reply: `❌ Pedido #${orderId} no encontrado.` };
  }

  if (existing.status === status) {
    return { reply: `ℹ️ El pedido #${orderId} ya está en estado *${status}*.` };
  }

  if (status === "entregado" && existing.status === "pendiente") {
    return {
      reply: `⚠️ El pedido #${orderId} aún está *pendiente*. Usa primero */confirmar ${orderId}*`,
    };
  }

  const order = await updateOrderStatus(orderId, status);
  if (!order) {
    return { reply: `❌ No se pudo actualizar el pedido #${orderId}.` };
  }

  const adminReply =
    status === "confirmado"
      ? `👨‍🍳 Pedido #${orderId} marcado *en preparación*. Cliente notificado.`
      : `✅ Pedido #${orderId} marcado *entregado*. Cliente notificado.`;

  return {
    reply: adminReply,
    customerNotification: {
      chatId: order.chatId,
      text: buildCustomerNotification(order, status),
    },
  };
}

function buildCustomerNotification(
  order: Order,
  status: "confirmado" | "entregado",
): string {
  if (status === "confirmado") {
    return `👨‍🍳 *Pedido #${order.id}* — en preparación

Tu pedido ya está en cocina. Te avisaremos cuando esté listo.

Escribe *3* para consultar el estado.`;
  }

  const readyLine =
    order.deliveryType === "domicilio"
      ? "🛵 Tu pedido salió hacia tu dirección."
      : "🏪 Tu pedido está listo para recoger en local.";

  return `✅ *Pedido #${order.id}* — ¡listo!

${readyLine}

Total: *${formatCurrency(order.total)}*

¡Gracias por pedir en *${getRestaurantName()}*! 🐟`;
}

async function handleCancelOrder(
  orderId?: string,
): Promise<AdminCommandResult> {
  if (!orderId) {
    return { reply: "Indica el número: */cancelar 1001*" };
  }

  const existing = await getOrder(orderId);
  if (!existing) {
    return { reply: `❌ Pedido #${orderId} no encontrado.` };
  }

  if (existing.status === "cancelado") {
    return { reply: `ℹ️ El pedido #${orderId} ya está *cancelado*.` };
  }

  if (existing.status !== "pendiente") {
    return {
      reply: `⚠️ Solo se pueden cancelar pedidos *pendientes*. El #${orderId} está en *${existing.status}*.`,
    };
  }

  const order = await cancelOrder(orderId, "admin");
  if (!order) {
    return { reply: `❌ No se pudo cancelar el pedido #${orderId}.` };
  }

  return {
    reply: `❌ Pedido #${orderId} *cancelado*. Cliente notificado.`,
    customerNotification: {
      chatId: order.chatId,
      text: `❌ *Pedido #${order.id}* cancelado

Tu pedido fue cancelado por el restaurante. Si tienes dudas, contáctanos directamente.

Escribe *hola* para hacer un nuevo pedido.`,
    },
  };
}

async function handleValidateOrder(
  orderId?: string,
  validationToken?: string,
  adminChatId?: string,
): Promise<AdminCommandResult> {
  if (!orderId && !validationToken) {
    return {
      reply: "Indica el pedido: */validar 1001* o pega el código del QR.",
    };
  }

  let targetId = orderId;
  let token = validationToken;

  if (!targetId && token) {
    const byToken = await getOrderByValidationToken(token);
    if (!byToken) {
      return { reply: "❌ Código QR no válido o pedido no encontrado." };
    }
    targetId = byToken.id;
    token = byToken.validationToken;
  }

  if (!targetId) {
    return { reply: "❌ No se pudo identificar el pedido." };
  }

  const result = await validateOrder(
    targetId,
    adminChatId ?? "admin",
    token,
  );

  if (!result.ok) {
    switch (result.error) {
      case "not_found":
        return { reply: `❌ Pedido #${targetId} no encontrado.` };
      case "invalid_token":
        return { reply: `❌ Token inválido para el pedido #${targetId}.` };
      case "cancelado":
        return { reply: `❌ El pedido #${targetId} está *cancelado*.` };
      case "already_validated":
        return {
          reply: `ℹ️ El pedido #${targetId} ya fue *validado/entregado*.`,
        };
      default:
        return { reply: `❌ No se pudo validar el pedido #${targetId}.` };
    }
  }

  const order = result.order;
  const readyLine =
    order.deliveryType === "domicilio"
      ? "🛵 Tu pedido fue entregado. ¡Gracias!"
      : "🏪 Pedido recogido. ¡Gracias!";

  return {
    reply: `✅ Pedido #${order.id} *validado* y marcado entregado. Cliente notificado.`,
    customerNotification: {
      chatId: order.chatId,
      text: `✅ *Pedido #${order.id}* validado

${readyLine}

Total: *${formatCurrency(order.total)}*

¡Gracias por pedir en *${getRestaurantName()}*! 🐟`,
    },
  };
}

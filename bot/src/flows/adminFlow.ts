import {
  getOrder,
  getPendingOrders,
  updateOrderStatus,
  type Order,
} from "../orders/index.js";
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
/ver [número] — Ver detalle de un pedido
/ayuda — Mostrar esta ayuda

Ejemplos:
  /pedidos
  /confirmar 1001
  /listo 1001`;
}

export async function handleAdminCommand(
  text: string,
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
    default:
      return { reply: helpText() };
  }
}

type AdminCommand = "pedidos" | "confirmar" | "listo" | "ver" | "ayuda";

function parseAdminCommand(text: string): {
  command: AdminCommand;
  orderId?: string;
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
    /^\/(pedidos|confirmar|listo|entregado|ver|ayuda)(?:\s+#?(\d+))?$/i,
  );
  if (withSlash) {
    return mapCommand(withSlash[1], withSlash[2]);
  }

  const withoutSlash = normalized.match(
    /^(pedidos|confirmar|listo|entregado|ver)(?:\s+#?(\d+))?$/,
  );
  if (withoutSlash) {
    return mapCommand(withoutSlash[1], withoutSlash[2]);
  }

  return null;
}

function mapCommand(
  raw: string,
  orderId?: string,
): { command: AdminCommand; orderId?: string } | null {
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

  lines.push("\nUsa */confirmar [número]* o */listo [número]*");
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

  return {
    reply: `📦 *Pedido #${order.id}*
Estado: ${order.status}
Cliente: ${order.customerName ?? "—"}
${delivery}

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

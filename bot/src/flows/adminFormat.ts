import type { Order } from "../orders/types.js";
import { formatPaymentMethod } from "../orders/payment.js";
import { formatCurrency } from "../utils/format.js";

function truncate(text: string | undefined, max: number): string {
  if (!text) return "—";
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function formatOrderAge(createdAt: Date): string {
  const minutes = Math.floor((Date.now() - createdAt.getTime()) / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return createdAt.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusIcon(status: Order["status"]): string {
  return {
    pendiente: "⏳",
    confirmado: "👨‍🍳",
    entregado: "✅",
    cancelado: "❌",
  }[status];
}

export function formatAdminOrderLine(order: Order): string {
  const customer = order.customerName ? ` — ${order.customerName}` : "";
  const delivery =
    order.deliveryType === "domicilio"
      ? `🛵 ${truncate(order.address, 28)}`
      : "🏪 recoger";
  const payment = order.paymentMethod
    ? ` — ${formatPaymentMethod(order.paymentMethod)}`
    : "";

  return `${statusIcon(order.status)} #${order.id}${customer} — ${formatCurrency(order.total)} — ${delivery}${payment} — ${formatOrderAge(order.createdAt)}`;
}

export function formatAdminOrderList(
  title: string,
  orders: Order[],
  footer: string,
  emptyMessage: string,
): string {
  if (!orders.length) {
    return emptyMessage;
  }

  const lines = [`${title} (${orders.length})\n`];
  orders.forEach((order) => lines.push(formatAdminOrderLine(order)));
  lines.push(`\n${footer}`);
  return lines.join("\n");
}

export function formatGroupedActiveOrders(orders: Order[]): string {
  if (!orders.length) {
    return "✅ No hay pedidos activos.";
  }

  const nuevos = orders.filter((order) => order.status === "pendiente");
  const porEntregar = orders.filter((order) => order.status === "confirmado");

  const lines = [`📋 *Pedidos activos (${orders.length})*\n`];

  if (nuevos.length) {
    lines.push(`⏳ *Nuevos — recién llegados (${nuevos.length})*`);
    nuevos.forEach((order) => lines.push(formatAdminOrderLine(order)));
    lines.push("");
  }

  if (porEntregar.length) {
    lines.push(`👨‍🍳 *Por entregar — listos (${porEntregar.length})*`);
    porEntregar.forEach((order) => lines.push(formatAdminOrderLine(order)));
    lines.push("");
  }

  lines.push(
    "Usa */confirmar*, */listo*, */validar*, */ver* o */entregas*",
  );
  return lines.join("\n").trim();
}

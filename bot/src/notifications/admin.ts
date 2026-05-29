import { formatCurrency } from "../utils/format.js";
import { sendTextMessage } from "../openwa/client.js";
import { getAdminWhatsAppId } from "../restaurant/profile.js";
import type { Order } from "../orders/types.js";

export async function notifyAdminNewOrder(order: Order): Promise<void> {
  const adminId = getAdminWhatsAppId();
  if (!adminId) return;

  const deliveryLine =
    order.deliveryType === "domicilio"
      ? `📍 Domicilio: ${order.address}`
      : "🏪 Recoger en local";

  const items = order.items
    .map(
      (item) =>
        `• ${item.quantity}x ${item.name} — ${formatCurrency(item.unitPrice * item.quantity)}`,
    )
    .join("\n");

  const customer = order.customerName
    ? `👤 ${order.customerName}\n`
    : "";

  const text = `🔔 *Nuevo pedido #${order.id}*

${customer}${items}

${deliveryLine}
Total: *${formatCurrency(order.total)}*
Estado: pendiente

Actualiza el estado en Firebase Console:
restaurants → orders → #${order.id} → status`;

  try {
    await sendTextMessage(adminId, text);
    console.log(`Notificación enviada al admin ${adminId}`);
  } catch (error) {
    console.error("No se pudo notificar al admin:", error);
  }
}

export async function notifyAdminOrderCancelled(order: Order): Promise<void> {
  const adminId = getAdminWhatsAppId();
  if (!adminId) return;

  const by = order.cancelledBy === "admin" ? "admin" : "cliente";
  const text = `❌ *Pedido #${order.id} cancelado*

Cancelado por: ${by}
Cliente: ${order.customerName ?? "—"}
Total: ${formatCurrency(order.total)}`;

  try {
    await sendTextMessage(adminId, text);
  } catch (error) {
    console.error("No se pudo notificar cancelación al admin:", error);
  }
}

import { generateOrderPdf } from "../orders/pdf.js";
import type { Order } from "../orders/types.js";
import { sendDocumentMessage } from "../openwa/client.js";
import { getAdminWhatsAppId } from "../restaurant/profile.js";

export async function sendOrderReceipt(order: Order): Promise<void> {
  if (!order.validationToken) {
    console.warn(`Pedido #${order.id} sin token — no se envía PDF`);
    return;
  }

  try {
    const pdf = await generateOrderPdf(order);
    const filename = `pedido-${order.id}.pdf`;
    const caption = `📄 Comprobante pedido #${order.id}`;

    await sendDocumentMessage(order.chatId, pdf, filename, caption);
    console.log(`PDF enviado al cliente ${order.chatId}`);

    const adminId = getAdminWhatsAppId();
    if (adminId && adminId !== order.chatId) {
      const adminCaption = `📄 Pedido #${order.id}${order.customerName ? ` — ${order.customerName}` : ""}`;
      await sendDocumentMessage(adminId, pdf, filename, adminCaption);
      console.log(`PDF enviado al admin ${adminId}`);
    }
  } catch (error) {
    console.error(`No se pudo enviar comprobante PDF #${order.id}:`, error);
  }
}

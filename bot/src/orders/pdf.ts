import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { getRestaurantName } from "../restaurant/profile.js";
import { formatCurrency } from "../utils/format.js";
import { formatPaymentDetail, formatPaymentMethod } from "./payment.js";
import type { Order } from "./types.js";
import { buildQrPayload } from "./validation.js";

function formatDate(date: Date): string {
  return date.toLocaleString("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export async function generateOrderPdf(order: Order): Promise<Buffer> {
  if (!order.validationToken) {
    throw new Error("El pedido no tiene token de validación");
  }

  const qrPayload = buildQrPayload(order.id, order.validationToken);
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 220,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  const qrBuffer = Buffer.from(
    qrDataUrl.replace(/^data:image\/png;base64,/, ""),
    "base64",
  );

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A5", margin: 36 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const restaurant = getRestaurantName();
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.fontSize(16).font("Helvetica-Bold").text(restaurant, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(11).font("Helvetica").text("Comprobante de pedido", { align: "center" });
    doc.moveDown(0.5);

    doc.fontSize(10).font("Helvetica-Bold").text(`Pedido #${order.id}`);
    doc.font("Helvetica").text(`Fecha: ${formatDate(order.createdAt)}`);
    doc.text(`Cliente: ${order.customerName?.trim() || "—"}`);
    doc.moveDown(0.4);

    doc.font("Helvetica-Bold").text("Detalle");
    doc.font("Helvetica");
    for (const item of order.items) {
      const line = `${item.quantity}x ${item.name}`;
      const price = formatCurrency(item.unitPrice * item.quantity);
      doc.text(`${line}  ${price}`);
    }

    doc.moveDown(0.4);
    doc.text(`Subtotal: ${formatCurrency(order.subtotal)}`, { align: "right" });
    if (order.deliveryFee > 0) {
      doc.text(`Domicilio: ${formatCurrency(order.deliveryFee)}`, { align: "right" });
    }
    doc.font("Helvetica-Bold").text(`TOTAL: ${formatCurrency(order.total)}`, {
      align: "right",
    });
    doc.font("Helvetica");
    doc.moveDown(0.5);

    const deliveryLine =
      order.deliveryType === "domicilio"
        ? `Domicilio${order.addressAlias ? ` (${order.addressAlias})` : ""}: ${order.address ?? "—"}`
        : "Recoger en local";
    doc.text(`Entrega: ${deliveryLine}`);

    if (order.paymentMethod) {
      doc.text(`Pago: ${formatPaymentMethod(order.paymentMethod)}`);
      const paymentDetail = formatPaymentDetail(
        order.paymentMethod,
        order.cashPaid,
        order.changeDue,
      );
      if (paymentDetail.includes("\n")) {
        paymentDetail.split("\n").slice(1).forEach((line) => doc.text(line));
      }
    }

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").text("Validación", { align: "center" });
    doc.moveDown(0.3);

    const qrSize = 110;
    const qrX = (doc.page.width - qrSize) / 2;
    doc.image(qrBuffer, qrX, doc.y, { width: qrSize, height: qrSize });
    doc.y += qrSize + 8;

    doc.fontSize(8).font("Helvetica").text(
      "Presenta este código al recoger o recibir tu pedido.\nEl restaurante lo escaneará para validar la entrega.",
      { align: "center", width: pageWidth },
    );

    doc.end();
  });
}

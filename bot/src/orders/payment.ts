import { formatCurrency } from "../utils/format.js";
import type { PaymentMethod } from "./types.js";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  yape: "📱 Yape",
  plin: "📱 Plin",
  transferencia: "🏦 Transferencia",
  efectivo: "💵 Efectivo",
};

export function formatPaymentMethod(method: PaymentMethod): string {
  return PAYMENT_LABELS[method];
}

export function formatPaymentDetail(
  method: PaymentMethod,
  cashPaid?: number,
  changeDue?: number,
): string {
  const line = formatPaymentMethod(method);
  if (method !== "efectivo" || cashPaid === undefined) {
    return line;
  }

  const parts = [line, `Paga con: ${formatCurrency(cashPaid)}`];
  if (changeDue !== undefined && changeDue > 0) {
    parts.push(`Vuelto: ${formatCurrency(changeDue)}`);
  }
  return parts.join("\n");
}

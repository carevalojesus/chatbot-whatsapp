import { formatPaymentMethod } from "../orders/payment.js";
import { config } from "../config.js";
import type { PaymentMethod } from "../orders/types.js";
import type { UserSession } from "../session/types.js";
import { formatCurrency } from "../utils/format.js";

function paymentDestination(method: PaymentMethod): string {
  switch (method) {
    case "yape":
      return `Yape al *${config.restaurant.yapePhone}*`;
    case "plin":
      return `Plin al *${config.restaurant.plinPhone}*`;
    case "transferencia":
      return config.restaurant.bankAccount
        ? `Transferencia:\n${config.restaurant.bankAccount}`
        : `Transferencia — consulta datos al restaurante`;
    default:
      return "";
  }
}

export function buildPaymentProofPrompt(session: UserSession, total: number): string {
  const method = session.paymentMethod!;
  const destination = paymentDestination(method);

  return `💳 *Pago con ${formatPaymentMethod(method)}*

Total a pagar: *${formatCurrency(total)}*

${destination}

1️⃣ Envía la *captura de pantalla* del pago aquí
2️⃣ O escribe *listo* si ya pagaste (sin captura)

*0* ← volver a métodos de pago`;
}

export function requiresPaymentProof(method?: PaymentMethod): boolean {
  return method === "yape" || method === "plin" || method === "transferencia";
}

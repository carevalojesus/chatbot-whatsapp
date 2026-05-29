import { getOrdersForChat } from "../orders/index.js";
import type { UserSession } from "../session/types.js";
import { goToCheckout } from "./orderNavigation.js";
import { isRestaurantOpen, closedOrderBlockMessage } from "../restaurant/hours.js";

export async function tryRepeatLastOrder(
  session: UserSession,
): Promise<string | null> {
  const orders = await getOrdersForChat(session.chatId);
  const last = orders.find((order) => order.status !== "cancelado");

  if (!last?.items.length) {
    return null;
  }

  const open = isRestaurantOpen();
  if (!open.open) {
    return closedOrderBlockMessage();
  }

  session.cart = last.items.map((item) => ({ ...item }));
  session.deliveryType = last.deliveryType;
  session.address = last.address;
  session.addressAlias = last.addressAlias;
  session.paymentMethod = undefined;
  session.cashPaid = undefined;
  session.changeDue = undefined;
  session.selectedCategoryIndex = undefined;
  session.pendingItemIndex = undefined;

  const lines = last.items.map(
    (item) => `• ${item.quantity}× ${item.name}`,
  );

  return `🔁 *Pedido repetido*

${lines.join("\n")}

¿Cómo lo recibes?

${goToCheckout(session)}`;
}

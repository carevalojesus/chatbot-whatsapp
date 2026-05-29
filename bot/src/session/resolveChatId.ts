import { getCustomerByChatId } from "../customers/index.js";
import { getAdminWhatsAppId, isAdminChatId } from "../restaurant/profile.js";
import type { UserSession } from "./types.js";

/** Unifica @lid y @c.us para usar una sola sesión por cliente. */
export async function resolveSessionChatId(chatId: string): Promise<string> {
  if (isAdminChatId(chatId)) {
    return getAdminWhatsAppId();
  }

  if (chatId.endsWith("@c.us")) {
    return chatId;
  }

  const customer = await getCustomerByChatId(chatId);
  const phoneChat = customer?.chatIds.find((id) => id.endsWith("@c.us"));
  return phoneChat ?? chatId;
}

export function mergeOrderingSession(
  target: UserSession,
  source: UserSession,
): void {
  const sourceActive =
    source.state !== "main_menu" || source.cart.length > 0;
  const targetActive =
    target.state !== "main_menu" || target.cart.length > 0;

  if (!sourceActive) {
    return;
  }

  if (!targetActive || source.cart.length > target.cart.length) {
    let mergedState = source.state;
    if (mergedState === "browse_categories" && source.cart.length > 0) {
      mergedState = "after_add_to_cart";
    }

    target.state = mergedState;
    target.cart = [...source.cart];
    target.selectedCategoryIndex = source.selectedCategoryIndex;
    target.pendingItemIndex = source.pendingItemIndex;
    target.deliveryType = source.deliveryType;
    target.address = source.address;
    target.addressAlias = source.addressAlias;
    target.paymentMethod = source.paymentMethod;
    target.cashPaid = source.cashPaid;
    target.changeDue = source.changeDue;
    target.cartReturnState = source.cartReturnState;
    target.awaitingInactivityConfirm = source.awaitingInactivityConfirm;
  }
}

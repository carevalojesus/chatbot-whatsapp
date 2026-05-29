export type BotState =
  | "main_menu"
  | "browse_categories"
  | "browse_items"
  | "enter_quantity"
  | "choose_delivery"
  | "enter_address"
  | "confirm_order"
  | "check_order_status";

export interface CartItem {
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface UserSession {
  chatId: string;
  customerName?: string;
  state: BotState;
  cart: CartItem[];
  selectedCategoryIndex?: number;
  pendingItemIndex?: number;
  deliveryType?: "domicilio" | "recoger";
  address?: string;
}

const sessions = new Map<string, UserSession>();

export function getSession(chatId: string): UserSession {
  const existing = sessions.get(chatId);
  if (existing) return existing;

  const session: UserSession = {
    chatId,
    state: "main_menu",
    cart: [],
  };
  sessions.set(chatId, session);
  return session;
}

export function resetSession(chatId: string): UserSession {
  const session = getSession(chatId);
  session.state = "main_menu";
  session.cart = [];
  session.selectedCategoryIndex = undefined;
  session.pendingItemIndex = undefined;
  session.deliveryType = undefined;
  session.address = undefined;
  return session;
}

export function clearCart(chatId: string): void {
  const session = getSession(chatId);
  session.cart = [];
}

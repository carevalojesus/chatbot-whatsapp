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

export function createEmptySession(chatId: string): UserSession {
  return {
    chatId,
    state: "main_menu",
    cart: [],
  };
}

export function clearSessionFields(session: UserSession): UserSession {
  session.state = "main_menu";
  session.cart = [];
  session.selectedCategoryIndex = undefined;
  session.pendingItemIndex = undefined;
  session.deliveryType = undefined;
  session.address = undefined;
  return session;
}

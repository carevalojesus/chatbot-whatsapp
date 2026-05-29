export type BotState =
  | "main_menu"
  | "browse_categories"
  | "browse_items"
  | "enter_quantity"
  | "choose_delivery"
  | "choose_saved_address"
  | "enter_address"
  | "save_address_prompt"
  | "confirm_order"
  | "check_order_status"
  | "order_detail"
  | "confirm_cancel_order"
  | "profile_menu"
  | "edit_name"
  | "address_menu"
  | "add_address_alias"
  | "add_address_line";

export interface CartItem {
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface UserSession {
  chatId: string;
  customerId?: string;
  customerName?: string;
  state: BotState;
  cart: CartItem[];
  selectedCategoryIndex?: number;
  pendingItemIndex?: number;
  deliveryType?: "domicilio" | "recoger";
  address?: string;
  addressAlias?: string;
  selectedOrderId?: string;
  pendingAddressAlias?: string;
  pendingAddressLine?: string;
}

export function createEmptySession(chatId: string): UserSession {
  return {
    chatId,
    state: "main_menu",
    cart: [],
  };
}

export function clearSessionFields(session: UserSession): UserSession {
  const { customerId, customerName } = session;
  session.state = "main_menu";
  session.cart = [];
  session.selectedCategoryIndex = undefined;
  session.pendingItemIndex = undefined;
  session.deliveryType = undefined;
  session.address = undefined;
  session.addressAlias = undefined;
  session.selectedOrderId = undefined;
  session.pendingAddressAlias = undefined;
  session.pendingAddressLine = undefined;
  session.customerId = customerId;
  session.customerName = customerName;
  return session;
}

export function clearOrderingFields(session: UserSession): void {
  session.cart = [];
  session.selectedCategoryIndex = undefined;
  session.pendingItemIndex = undefined;
  session.deliveryType = undefined;
  session.address = undefined;
  session.addressAlias = undefined;
  session.pendingAddressAlias = undefined;
  session.pendingAddressLine = undefined;
}

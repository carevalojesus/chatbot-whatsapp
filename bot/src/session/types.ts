import type { PaymentMethod } from "../orders/types.js";

export type BotState =
  | "main_menu"
  | "view_menu_categories"
  | "view_menu_items"
  | "browse_categories"
  | "browse_items"
  | "enter_quantity"
  | "after_add_to_cart"
  | "cart_menu"
  | "choose_delivery"
  | "choose_saved_address"
  | "enter_address"
  | "save_address_prompt"
  | "choose_payment"
  | "enter_cash_amount"
  | "confirm_order"
  | "check_order_status"
  | "order_detail"
  | "confirm_cancel_order"
  | "profile_menu"
  | "edit_name"
  | "address_menu"
  | "add_address_alias"
  | "add_address_line"
  | "register_prompt"
  | "register_name";

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
  paymentMethod?: PaymentMethod;
  cashPaid?: number;
  changeDue?: number;
  selectedOrderId?: string;
  pendingAddressAlias?: string;
  pendingAddressLine?: string;
  whatsappName?: string;
  pendingAction?: "order";
  /** Estado al que volver desde cart_menu */
  cartReturnState?: BotState;
  /** Último mensaje del cliente (ms) — para expiración por inactividad */
  lastActivityAt?: number;
  /** Esperando respuesta al aviso de inactividad (1/0) */
  awaitingInactivityConfirm?: boolean;
}

export function createEmptySession(chatId: string): UserSession {
  return {
    chatId,
    state: "main_menu",
    cart: [],
    lastActivityAt: Date.now(),
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
  session.paymentMethod = undefined;
  session.cashPaid = undefined;
  session.changeDue = undefined;
  session.selectedOrderId = undefined;
  session.pendingAddressAlias = undefined;
  session.pendingAddressLine = undefined;
  session.whatsappName = undefined;
  session.pendingAction = undefined;
  session.cartReturnState = undefined;
  session.awaitingInactivityConfirm = undefined;
  session.customerId = customerId;
  session.customerName = customerName;
  return session;
}

export function isOrderingState(state: BotState): boolean {
  return [
    "browse_categories",
    "browse_items",
    "enter_quantity",
    "after_add_to_cart",
    "cart_menu",
    "choose_delivery",
    "choose_saved_address",
    "enter_address",
    "save_address_prompt",
    "choose_payment",
    "enter_cash_amount",
    "confirm_order",
  ].includes(state);
}

export function clearOrderingFields(session: UserSession): void {
  session.cart = [];
  session.selectedCategoryIndex = undefined;
  session.pendingItemIndex = undefined;
  session.deliveryType = undefined;
  session.address = undefined;
  session.addressAlias = undefined;
  session.paymentMethod = undefined;
  session.cashPaid = undefined;
  session.changeDue = undefined;
  session.pendingAddressAlias = undefined;
  session.pendingAddressLine = undefined;
  session.cartReturnState = undefined;
}

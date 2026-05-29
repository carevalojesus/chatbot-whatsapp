import { getCategoryByIndex, getItemByIndex, getMenu } from "../menu/data.js";
import type { CartItem, BotState, UserSession } from "../session/types.js";
import { clearOrderingFields } from "../session/types.js";
import { normalizeText, parseChoice } from "../utils/format.js";
import {
  formatAfterAddToCart,
  formatBrowseCategoriesPrompt,
  formatCartMenu,
  formatCategoryMenuForOrder,
  formatChooseDeliveryPrompt,
  formatEmptyCartMessage,
  formatQuantityPrompt,
  isFinishOrderCommand,
  isViewCartCommand,
} from "./orderPrompts.js";

export function hasCartItems(session: UserSession): boolean {
  return session.cart.length > 0;
}

export function addToCart(session: UserSession, item: CartItem): void {
  const existing = session.cart.find((entry) => entry.itemId === item.itemId);
  if (existing) {
    existing.quantity += item.quantity;
    return;
  }
  session.cart.push(item);
}

export function openCartMenu(session: UserSession): string {
  session.cartReturnState = session.state;
  session.state = "cart_menu";
  return formatCartMenu(session);
}

export function goToCategories(session: UserSession): string {
  session.state = "browse_categories";
  return formatBrowseCategoriesPrompt(session);
}

export function goToAfterAdd(session: UserSession): string {
  session.state = "after_add_to_cart";
  return formatAfterAddToCart(session);
}

export function goToCheckout(session: UserSession): string {
  if (!hasCartItems(session)) {
    session.state = "browse_categories";
    return `${formatEmptyCartMessage()}\n\n${formatBrowseCategoriesPrompt(session)}`;
  }
  session.state = "choose_delivery";
  return formatChooseDeliveryPrompt(session);
}

export function startFreshOrder(session: UserSession): string {
  clearOrderingFields(session);
  session.state = "browse_categories";
  return formatBrowseCategoriesPrompt(session);
}

/** Navegación *0* unificada durante el pedido. */
export function handleOrderBack(
  session: UserSession,
  mainMenu: () => string,
): string {
  switch (session.state) {
    case "browse_categories":
      clearOrderingFields(session);
      session.state = "main_menu";
      return mainMenu();
    case "browse_items":
      session.pendingItemIndex = undefined;
      return goToCategories(session);
    case "enter_quantity":
      session.pendingItemIndex = undefined;
      session.state = "browse_items";
      if (session.selectedCategoryIndex) {
        return formatCategoryMenuForOrder(session, session.selectedCategoryIndex);
      }
      return goToCategories(session);
    case "after_add_to_cart":
      return goToCategories(session);
    case "cart_menu": {
      const returnState = session.cartReturnState ?? "browse_categories";
      session.cartReturnState = undefined;
      session.state = returnState;
      if (returnState === "browse_items" && session.selectedCategoryIndex) {
        return formatCategoryMenuForOrder(session, session.selectedCategoryIndex);
      }
      if (returnState === "after_add_to_cart") {
        return formatAfterAddToCart(session);
      }
      return formatBrowseCategoriesPrompt(session);
    }
    case "choose_delivery":
      session.state = "after_add_to_cart";
      return hasCartItems(session)
        ? formatAfterAddToCart(session)
        : goToCategories(session);
    case "choose_saved_address":
    case "enter_address":
    case "save_address_prompt":
      session.state = "choose_delivery";
      return formatChooseDeliveryPrompt(session);
    case "choose_payment":
      if (session.deliveryType === "domicilio" && session.address) {
        session.state = "choose_delivery";
        return formatChooseDeliveryPrompt(session);
      }
      return openCartMenu(session);
    default:
      return goToCategories(session);
  }
}

export function tryOpenCart(session: UserSession, text: string): string | null {
  if (isViewCartCommand(text)) {
    return openCartMenu(session);
  }
  return null;
}

export function tryOrderBack(
  session: UserSession,
  normalized: string,
  mainMenu: () => string,
): string | null {
  if (normalized !== "0") {
    return null;
  }
  return handleOrderBack(session, mainMenu);
}

export function tryFinishOrder(
  session: UserSession,
  text: string,
): string | null {
  if (isFinishOrderCommand(text) && hasCartItems(session)) {
    return goToCheckout(session);
  }
  return null;
}

export function pickCategory(session: UserSession, choice: number): string | null {
  const category = getCategoryByIndex(choice);
  if (!category) {
    return null;
  }
  session.selectedCategoryIndex = choice;
  session.state = "browse_items";
  return formatCategoryMenuForOrder(session, choice);
}

export function pickCategoryFromAnyBrowseStep(
  session: UserSession,
  text: string,
): string | null {
  const menu = getMenu();
  const choice = parseChoice(text, menu.categories.length);
  if (!choice) {
    return null;
  }
  return pickCategory(session, choice);
}

export function resumePromptForState(
  session: UserSession,
  state: BotState,
): string | null {
  switch (state) {
    case "browse_categories":
      return formatBrowseCategoriesPrompt(session);
    case "browse_items":
      return session.selectedCategoryIndex
        ? formatCategoryMenuForOrder(session, session.selectedCategoryIndex)
        : formatBrowseCategoriesPrompt(session);
    case "enter_quantity": {
      const category = session.selectedCategoryIndex
        ? getCategoryByIndex(session.selectedCategoryIndex)
        : undefined;
      const item =
        category && session.pendingItemIndex
          ? getItemByIndex(category, session.pendingItemIndex)
          : undefined;
      return item
        ? formatQuantityPrompt(item.name, item.price)
        : formatBrowseCategoriesPrompt(session);
    }
    case "after_add_to_cart":
      return formatAfterAddToCart(session);
    case "cart_menu":
      return formatCartMenu(session);
    case "choose_delivery":
      return formatChooseDeliveryPrompt(session);
    default:
      return null;
  }
}

export function isOrderBrowseState(state: BotState): boolean {
  return [
    "browse_categories",
    "browse_items",
    "enter_quantity",
    "after_add_to_cart",
    "cart_menu",
  ].includes(state);
}

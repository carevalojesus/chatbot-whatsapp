import { listAddresses } from "../customers/index.js";
import { getCategoryByIndex, getItemByIndex } from "../menu/data.js";
import {
  ensureSessionCustomer,
  formatSavedAddressChoice,
  handleChooseSavedAddress,
} from "../flows/profileFlow.js";
import type { PaymentMethod } from "../orders/types.js";
import type { UserSession } from "../session/types.js";
import { normalizeText, parseAmount, parseChoice } from "../utils/format.js";
import { formatCurrency } from "../utils/format.js";
import {
  formatAfterAddToCart,
  formatBrowseCategoriesPrompt,
  formatCartMenu,
  formatCategoryMenuForOrder,
  formatChooseDeliveryPrompt,
  formatQuantityPrompt,
} from "./orderPrompts.js";
import {
  addToCart,
  goToAfterAdd,
  goToCategories,
  goToCheckout,
  hasCartItems,
  openCartMenu,
  pickCategoryFromAnyBrowseStep,
  tryFinishOrder,
  tryOpenCart,
  tryOrderBack,
} from "./orderNavigation.js";

type PaymentPromptBuilder = (session: UserSession) => string;
type PaymentProceed = (session: UserSession) => string;

export function handleBrowseCategories(
  session: UserSession,
  text: string,
  mainMenu: () => string,
): string {
  const normalized = normalizeText(text);

  const back = tryOrderBack(session, normalized, mainMenu);
  if (back) return back;

  const cart = tryOpenCart(session, text);
  if (cart) return cart;

  const finish = tryFinishOrder(session, text);
  if (finish) return finish;

  const categoryReply = pickCategoryFromAnyBrowseStep(session, text);
  if (categoryReply) {
    return categoryReply;
  }

  return `Elige un *número* de la lista.\n\n${formatBrowseCategoriesPrompt(session)}`;
}

export function handleBrowseItems(
  session: UserSession,
  text: string,
  mainMenu: () => string,
): string {
  const normalized = normalizeText(text);

  const back = tryOrderBack(session, normalized, mainMenu);
  if (back) return back;

  const cart = tryOpenCart(session, text);
  if (cart) return cart;

  const finish = tryFinishOrder(session, text);
  if (finish) return finish;

  const category = session.selectedCategoryIndex
    ? getCategoryByIndex(session.selectedCategoryIndex)
    : undefined;

  if (!category) {
    return goToCategories(session);
  }

  const choice = parseChoice(text, category.items.length);
  if (!choice) {
    return `Elige el *número* del plato.\n\n${formatCategoryMenuForOrder(
      session,
      session.selectedCategoryIndex!,
    )}`;
  }

  const item = getItemByIndex(category, choice);
  if (!item) {
    return goToCategories(session);
  }

  session.pendingItemIndex = choice;
  session.state = "enter_quantity";
  return formatQuantityPrompt(item.name, item.price);
}

export function handleEnterQuantity(
  session: UserSession,
  text: string,
  mainMenu: () => string,
): string {
  const normalized = normalizeText(text);

  const back = tryOrderBack(session, normalized, mainMenu);
  if (back) return back;

  const quantity = Number(text.trim());
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    const category = session.selectedCategoryIndex
      ? getCategoryByIndex(session.selectedCategoryIndex)
      : undefined;
    const item =
      category && session.pendingItemIndex
        ? getItemByIndex(category, session.pendingItemIndex)
        : undefined;

    if (item) {
      return `Cantidad inválida (1–20).\n\n${formatQuantityPrompt(item.name, item.price)}`;
    }
    return goToCategories(session);
  }

  const category = session.selectedCategoryIndex
    ? getCategoryByIndex(session.selectedCategoryIndex)
    : undefined;
  const item =
    category && session.pendingItemIndex
      ? getItemByIndex(category, session.pendingItemIndex)
      : undefined;

  if (!item) {
    return goToCategories(session);
  }

  addToCart(session, {
    itemId: item.id,
    name: item.name,
    unitPrice: item.price,
    quantity,
  });

  session.pendingItemIndex = undefined;
  return goToAfterAdd(session);
}

export function handleAfterAddToCart(
  session: UserSession,
  text: string,
  mainMenu: () => string,
): string {
  const normalized = normalizeText(text);

  const back = tryOrderBack(session, normalized, mainMenu);
  if (back) return back;

  const cart = tryOpenCart(session, text);
  if (cart) return cart;

  const quick = parseChoice(text, 3);
  if (quick === 1) {
    return goToCategories(session);
  }
  if (quick === 2) {
    return goToCheckout(session);
  }
  if (quick === 9) {
    return openCartMenu(session);
  }

  const categoryReply = pickCategoryFromAnyBrowseStep(session, text);
  if (categoryReply) {
    return categoryReply;
  }

  return `Responde con un *número*:\n\n${formatAfterAddToCart(session)}`;
}

export function handleCartMenu(
  session: UserSession,
  text: string,
  mainMenu: () => string,
): string {
  const normalized = normalizeText(text);

  const back = tryOrderBack(session, normalized, mainMenu);
  if (back) return back;

  const maxChoice = hasCartItems(session) ? 3 : 1;
  const choice = parseChoice(text, maxChoice);
  if (!choice) {
    return `Elige una *opción* numerada.\n\n${formatCartMenu(session)}`;
  }

  if (!hasCartItems(session)) {
    if (choice === 1) {
      return goToCategories(session);
    }
    return `Elige una *opción* numerada.\n\n${formatCartMenu(session)}`;
  }

  switch (choice) {
    case 1:
      return goToCategories(session);
    case 2:
      return goToCheckout(session);
    case 3:
      session.cart = [];
      return `🗑️ *Carrito vaciado.*\n\n${goToCategories(session)}`;
    default:
      return `Elige una *opción* numerada.\n\n${formatCartMenu(session)}`;
  }
}

export async function handleChooseDelivery(
  session: UserSession,
  text: string,
  mainMenu: () => string,
  proceedToPayment: PaymentProceed,
): Promise<string> {
  const normalized = normalizeText(text);

  const back = tryOrderBack(session, normalized, mainMenu);
  if (back) return back;

  const cart = tryOpenCart(session, text);
  if (cart) return cart;

  const choice = parseChoice(text, 2);
  if (!choice) {
    return `Elige *1* o *2*.\n\n${formatChooseDeliveryPrompt(session)}`;
  }

  session.deliveryType = choice === 1 ? "domicilio" : "recoger";

  if (session.deliveryType === "domicilio") {
    const customerId = await ensureSessionCustomer(session);
    const addresses = await listAddresses(customerId);

    if (addresses.length) {
      session.state = "choose_saved_address";
      return await formatSavedAddressChoice(customerId);
    }

    session.state = "enter_address";
    return "📍 ¿Cuál es tu dirección de entrega?\n(Incluye barrio y referencia)\n\n*0* ← volver";
  }

  return proceedToPayment(session);
}

export async function handleChooseSavedAddressFlow(
  session: UserSession,
  text: string,
  mainMenu: () => string,
  buildPaymentPrompt: PaymentPromptBuilder,
): Promise<string> {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    session.state = "choose_delivery";
    return formatChooseDeliveryPrompt(session);
  }

  const reply = await handleChooseSavedAddress(session, text);
  if (session.state === "choose_payment") {
    return reply || buildPaymentPrompt(session);
  }
  return reply;
}

export function handleEnterAddress(
  session: UserSession,
  text: string,
): string {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    session.state = "choose_delivery";
    return formatChooseDeliveryPrompt(session);
  }

  const address = text.trim();
  if (address.length < 8) {
    return "Escribe una dirección más completa (mínimo 8 caracteres).\n\n*0* ← volver";
  }

  session.address = address;
  session.addressAlias = undefined;
  session.state = "save_address_prompt";

  return `📍 Dirección: ${address}

¿Guardar para futuros pedidos?
Escribe un *alias* (Casa, Trabajo) o *no*

*0* ← volver`;
}

export async function handleSaveAddressPrompt(
  session: UserSession,
  text: string,
  proceedToPayment: PaymentProceed,
): Promise<string> {
  const normalized = normalizeText(text);

  if (normalized === "0") {
    session.state = "choose_delivery";
    return formatChooseDeliveryPrompt(session);
  }

  if (normalized !== "no") {
    const alias = text.trim();
    if (alias.length >= 2 && session.address && session.customerId) {
      try {
        const { addAddress } = await import("../customers/index.js");
        await addAddress(session.customerId, alias, session.address);
        session.addressAlias = alias;
      } catch {
        // alias duplicado — continuar
      }
    }
  }

  return proceedToPayment(session);
}

export function handleChoosePayment(
  session: UserSession,
  text: string,
  buildPaymentPrompt: PaymentPromptBuilder,
  buildCashPrompt: PaymentPromptBuilder,
  buildConfirmation: PaymentPromptBuilder,
): string {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    if (session.deliveryType === "domicilio" && session.address) {
      session.state = "choose_delivery";
      return formatChooseDeliveryPrompt(session);
    }
    return openCartMenu(session);
  }

  const choice = parseChoice(text, 4);
  if (!choice) {
    return `Elige *1* a *4*.\n\n${buildPaymentPrompt(session)}`;
  }

  const methods: PaymentMethod[] = [
    "yape",
    "plin",
    "transferencia",
    "efectivo",
  ];
  session.paymentMethod = methods[choice - 1];

  if (session.paymentMethod === "efectivo") {
    session.state = "enter_cash_amount";
    return buildCashPrompt(session);
  }

  session.cashPaid = undefined;
  session.changeDue = undefined;
  session.state = "confirm_order";
  return buildConfirmation(session);
}

export function handleEnterCashAmount(
  session: UserSession,
  text: string,
  total: number,
  buildPaymentPrompt: PaymentPromptBuilder,
  buildCashPrompt: PaymentPromptBuilder,
  buildConfirmation: PaymentPromptBuilder,
): string {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    session.state = "choose_payment";
    session.cashPaid = undefined;
    session.changeDue = undefined;
    return buildPaymentPrompt(session);
  }

  const amount = parseAmount(text);
  if (!amount) {
    return `Monto inválido.\n\n${buildCashPrompt(session)}`;
  }

  if (amount < total) {
    return `Debe ser al menos *${formatCurrency(total)}*.\n\n${buildCashPrompt(session)}`;
  }

  session.cashPaid = amount;
  session.changeDue = Math.round((amount - total) * 100) / 100;
  session.state = "confirm_order";
  return buildConfirmation(session);
}

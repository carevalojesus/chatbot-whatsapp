import { listAddresses, recordCustomerOrder } from "../customers/index.js";
import { getMenu, getCategoryByIndex, getItemByIndex } from "../menu/data.js";
import {
  formatCategoryMenu,
  formatMenuItemDetail,
  formatMenuOverview,
  formatOrderCategoriesPrompt,
} from "../menu/format.js";
import {
  cancelOrder,
  createOrder,
  getOrder,
  getOrdersForChat,
  type Order,
  type PaymentMethod,
} from "../orders/index.js";
import { formatPaymentDetail } from "../orders/payment.js";
import { notifyAdminNewOrder, notifyAdminOrderCancelled } from "../notifications/admin.js";
import { sendOrderReceipt } from "../notifications/receipt.js";
import {
  buildProfileMenu,
  buildRegistrationPrompt,
  ensureSessionCustomer,
  formatSavedAddressChoice,
  handleChooseSavedAddress,
  handleProfileFlow,
  handleRegistrationFlow,
  shouldPromptRegistration,
} from "../flows/profileFlow.js";
import { getCustomerByChatId } from "../customers/index.js";
import {
  getDeliveryFee,
  getRestaurantName,
  getRestaurantProfile,
} from "../restaurant/profile.js";
import {
  getSession,
  resetSession,
  saveSession,
  clearSessionFields,
  isOrderingState,
  type CartItem,
  type UserSession,
} from "../session/index.js";
import { formatCurrency, normalizeText, parseAmount, parseChoice } from "../utils/format.js";

function mainMenu(): string {
  return `¡Hola! Bienvenido a *${getRestaurantName()}* 🍽️

¿Qué deseas hacer?

1️⃣ Ver carta completa
2️⃣ Hacer un pedido
3️⃣ Mis pedidos
4️⃣ Mi perfil
5️⃣ Ayuda

Escribe el *número* de la opción.`;
}

function helpText(): string {
  const profile = getRestaurantProfile();
  return `ℹ️ *Ayuda*

• Escribe *hola* o *menu* para volver al inicio
• Durante un pedido, *carrito* muestra lo que llevas
• *cancelar* aborta el pedido en curso
• Pedidos *pendientes* se pueden cancelar en *Mis pedidos*

Horario: ${profile.schedule}
Domicilio: ${profile.deliveryZone}`;
}

export async function handleIncomingMessage(
  chatId: string,
  text: string,
  customerName?: string,
): Promise<string> {
  const session = await getSession(chatId);
  if (customerName) {
    session.whatsappName = customerName;
  }

  const existingCustomer = await getCustomerByChatId(chatId);
  if (existingCustomer) {
    session.customerId = existingCustomer.id;
    if (existingCustomer.name) {
      session.customerName = existingCustomer.name;
    }
  }

  const normalized = normalizeText(text);

  let skipSave = false;
  let reply: string;

  if (isGlobalCommand(normalized)) {
    clearSessionFields(session);
    if (customerName) {
      session.whatsappName = customerName;
    }
    if (existingCustomer) {
      session.customerId = existingCustomer.id;
      if (existingCustomer.name) {
        session.customerName = existingCustomer.name;
      }
    }

    if (await shouldPromptRegistration(chatId)) {
      session.state = "register_prompt";
      reply = buildRegistrationPrompt(session.whatsappName);
    } else {
      reply = mainMenu();
    }
  } else if (normalized === "cancelar" && session.state !== "main_menu") {
    if (
      session.state === "order_detail" ||
      session.state === "confirm_cancel_order"
    ) {
      session.state = "check_order_status";
      session.selectedOrderId = undefined;
      reply = await formatOrderStatusList(session.chatId);
    } else if (isProfileState(session.state)) {
      session.state = "main_menu";
      session.pendingAction = undefined;
      reply = mainMenu();
    } else if (
      session.state === "view_menu_categories" ||
      session.state === "view_menu_items"
    ) {
      session.state = "main_menu";
      reply = mainMenu();
    } else {
      await resetSession(chatId);
      skipSave = true;
      reply = "Pedido cancelado. Escribe *hola* cuando quieras volver a pedir.";
    }
  } else if (isCartCommand(normalized, session.state)) {
    reply = formatCartView(session);
  } else {
    switch (session.state) {
      case "main_menu":
        reply = await handleMainMenu(session, text);
        break;
      case "view_menu_categories":
        reply = handleViewMenuCategories(session, text);
        break;
      case "view_menu_items":
        reply = handleViewMenuItems(session, text);
        break;
      case "browse_categories":
        reply = handleBrowseCategories(session, text);
        break;
      case "browse_items":
        reply = handleBrowseItems(session, text);
        break;
      case "enter_quantity":
        reply = handleEnterQuantity(session, text);
        break;
      case "choose_delivery":
        reply = await handleChooseDelivery(session, text);
        break;
      case "choose_saved_address":
        reply = await handleChooseSavedAddressFlow(session, text);
        break;
      case "enter_address":
        reply = handleEnterAddress(session, text);
        break;
      case "save_address_prompt":
        reply = await handleSaveAddressPrompt(session, text);
        break;
      case "choose_payment":
        reply = handleChoosePayment(session, text);
        break;
      case "enter_cash_amount":
        reply = handleEnterCashAmount(session, text);
        break;
      case "confirm_order":
        reply = await handleConfirmOrder(session, text);
        if (
          normalized === "0" ||
          normalized === "no" ||
          normalized === "si" ||
          normalized === "sí" ||
          normalized === "confirmar"
        ) {
          skipSave = true;
        }
        break;
      case "check_order_status": {
        const result = await handleCheckOrderStatus(session, text);
        reply = result.reply;
        skipSave = result.skipSave;
        break;
      }
      case "order_detail": {
        const result = await handleOrderDetail(session, text);
        reply = result.reply;
        skipSave = result.skipSave;
        break;
      }
      case "confirm_cancel_order": {
        const result = await handleConfirmCancelOrder(session, text);
        reply = result.reply;
        skipSave = result.skipSave;
        break;
      }
      case "register_prompt":
      case "register_name": {
        const regResult = await handleRegistrationFlow(session, text);
        if (regResult.continueOrder) {
          session.state = "browse_categories";
          const intro = regResult.reply ? `${regResult.reply}\n\n` : "";
          reply = `${intro}${formatOrderCategoriesPrompt(getMenu().categories)}`;
        } else if (regResult.done) {
          session.state = "main_menu";
          reply = regResult.reply
            ? `${regResult.reply}\n\n${mainMenu()}`
            : mainMenu();
        } else {
          reply = regResult.reply;
        }
        break;
      }
      case "profile_menu":
      case "edit_name":
      case "address_menu":
      case "add_address_alias":
      case "add_address_line": {
        const profileResult = await handleProfileFlow(session, text);
        if (profileResult.done) {
          session.state = "main_menu";
        }
        reply = profileResult.done ? mainMenu() : profileResult.reply;
        break;
      }
      default:
        await resetSession(chatId);
        skipSave = true;
        reply = mainMenu();
    }
  }

  if (!skipSave) {
    await saveSession(session);
  }

  return reply;
}

function isCartCommand(text: string, state: UserSession["state"]): boolean {
  return (
    (text === "carrito" || text === "ver carrito" || text === "mi carrito") &&
    isOrderingState(state)
  );
}

function formatCartView(session: UserSession): string {
  const lines = [formatCartSummary(session), ""];

  if (!session.cart.length) {
    lines.push("Agrega platos eligiendo una categoría.");
  } else if (
    session.state === "browse_categories" ||
    session.state === "browse_items" ||
    session.state === "enter_quantity"
  ) {
    lines.push("Escribe *listo* cuando termines de agregar platos.");
  } else {
    lines.push("Continúa con el paso actual o escribe *0* para volver.");
  }

  return lines.join("\n");
}

function calculateOrderTotal(session: UserSession): number {
  const subtotal = calculateSubtotal(session.cart);
  const deliveryFee =
    session.deliveryType === "domicilio" ? getDeliveryFee() : 0;
  return subtotal + deliveryFee;
}

function buildChoosePaymentPrompt(session: UserSession): string {
  const total = calculateOrderTotal(session);
  return `💳 *¿Cómo deseas pagar?*

Total a pagar: *${formatCurrency(total)}*

1️⃣ Yape
2️⃣ Plin
3️⃣ Transferencia bancaria
4️⃣ Efectivo

*0* para volver`;
}

function buildEnterCashPrompt(session: UserSession): string {
  const total = calculateOrderTotal(session);
  return `💵 *Pago en efectivo*

Total del pedido: *${formatCurrency(total)}*

¿Con cuánto vas a pagar?
Escribe el monto (ej: 100). Debe ser *igual o mayor* al total.

*0* para volver`;
}

function proceedToPayment(session: UserSession): string {
  session.state = "choose_payment";
  session.paymentMethod = undefined;
  session.cashPaid = undefined;
  session.changeDue = undefined;
  return buildChoosePaymentPrompt(session);
}

function handleChoosePayment(session: UserSession, text: string): string {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    if (session.deliveryType === "domicilio") {
      session.state = "choose_delivery";
      return `🚚 ¿Cómo deseas recibir tu pedido?

1️⃣ Domicilio (+${formatCurrency(getDeliveryFee())})
2️⃣ Recoger en local

*0* para volver.`;
    }
    session.state = "browse_categories";
    return buildCategoriesPrompt();
  }

  const choice = parseChoice(text, 4);
  if (!choice) {
    return `Opción inválida.\n\n${buildChoosePaymentPrompt(session)}`;
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
    return buildEnterCashPrompt(session);
  }

  session.cashPaid = undefined;
  session.changeDue = undefined;
  session.state = "confirm_order";
  return buildOrderConfirmation(session);
}

function handleEnterCashAmount(session: UserSession, text: string): string {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    session.state = "choose_payment";
    session.cashPaid = undefined;
    session.changeDue = undefined;
    return buildChoosePaymentPrompt(session);
  }

  const amount = parseAmount(text);
  const total = calculateOrderTotal(session);

  if (!amount) {
    return `Monto inválido. Escribe un número (ej: 50 o 100).\n\n${buildEnterCashPrompt(session)}`;
  }

  if (amount < total) {
    return `El monto debe ser al menos *${formatCurrency(total)}*.\n\n${buildEnterCashPrompt(session)}`;
  }

  session.cashPaid = amount;
  session.changeDue = Math.round((amount - total) * 100) / 100;
  session.state = "confirm_order";
  return buildOrderConfirmation(session);
}

function isProfileState(state: UserSession["state"]): boolean {
  return [
    "profile_menu",
    "edit_name",
    "address_menu",
    "add_address_alias",
    "add_address_line",
    "register_prompt",
    "register_name",
  ].includes(state);
}

function isGlobalCommand(text: string): boolean {
  return ["hola", "menu", "inicio", "start", "hi", "hello"].includes(text);
}

async function handleMainMenu(session: UserSession, text: string): Promise<string> {
  const choice = parseChoice(text, 5);
  if (!choice) {
    return `No entendí esa opción.\n\n${mainMenu()}`;
  }

  switch (choice) {
    case 1:
      session.state = "view_menu_categories";
      return formatMenuOverview(getMenu().categories);
    case 2:
      if (await shouldPromptRegistration(session.chatId)) {
        session.pendingAction = "order";
        session.state = "register_prompt";
        return buildRegistrationPrompt(session.whatsappName);
      }
      session.state = "browse_categories";
      return formatOrderCategoriesPrompt(getMenu().categories);
    case 3:
      session.state = "check_order_status";
      return await formatOrderStatusList(session.chatId);
    case 4:
      session.state = "profile_menu";
      return await buildProfileMenu(session);
    case 5:
      return helpText();
    default:
      return mainMenu();
  }
}

function handleViewMenuCategories(session: UserSession, text: string): string {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    session.state = "main_menu";
    return mainMenu();
  }

  if (normalized === "2" || normalized === "pedir" || normalized === "pedido") {
    session.state = "browse_categories";
    return formatOrderCategoriesPrompt(getMenu().categories);
  }

  const menu = getMenu();
  const choice = parseChoice(text, menu.categories.length);
  if (!choice) {
    return `Opción inválida.\n\n${formatMenuOverview(menu.categories)}`;
  }

  const category = getCategoryByIndex(choice);
  if (!category) {
    return `Opción inválida.\n\n${formatMenuOverview(menu.categories)}`;
  }

  session.selectedCategoryIndex = choice;
  session.state = "view_menu_items";
  return formatCategoryMenu(category, { mode: "view" });
}

function handleViewMenuItems(session: UserSession, text: string): string {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    session.state = "view_menu_categories";
    session.selectedCategoryIndex = undefined;
    return formatMenuOverview(getMenu().categories);
  }

  if (normalized === "2" || normalized === "pedir" || normalized === "pedido") {
    session.state = "browse_categories";
    return formatOrderCategoriesPrompt(getMenu().categories);
  }

  const category = session.selectedCategoryIndex
    ? getCategoryByIndex(session.selectedCategoryIndex)
    : undefined;

  if (!category) {
    session.state = "view_menu_categories";
    return formatMenuOverview(getMenu().categories);
  }

  const choice = parseChoice(text, category.items.length);
  if (choice) {
    const item = getItemByIndex(category, choice);
    if (item) {
      return formatMenuItemDetail(item);
    }
  }

  return `Opción inválida.\n\n${formatCategoryMenu(category, { mode: "view" })}`;
}

function buildCategoriesPrompt(): string {
  return formatOrderCategoriesPrompt(getMenu().categories);
}

function handleBrowseCategories(session: UserSession, text: string): string {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    session.state = "main_menu";
    clearOrderingFields(session);
    return mainMenu();
  }

  if (normalized === "listo") {
    if (!session.cart.length) {
      return "Tu pedido está vacío. Elige al menos un plato antes de continuar.";
    }
    session.state = "choose_delivery";
    return `🚚 ¿Cómo deseas recibir tu pedido?

1️⃣ Domicilio (+${formatCurrency(getDeliveryFee())})
2️⃣ Recoger en local

*carrito* ver pedido · *0* volver`;
  }

  const menu = getMenu();
  const choice = parseChoice(text, menu.categories.length);
  if (!choice) {
    return `Opción inválida.\n\n${buildCategoriesPrompt()}`;
  }

  const category = getCategoryByIndex(choice);
  if (!category) {
    return `Opción inválida.\n\n${buildCategoriesPrompt()}`;
  }

  session.selectedCategoryIndex = choice;
  session.state = "browse_items";
  return formatCategoryMenu(category);
}

function handleBrowseItems(session: UserSession, text: string): string {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    session.state = "browse_categories";
    session.pendingItemIndex = undefined;
    return buildCategoriesPrompt();
  }

  const category = session.selectedCategoryIndex
    ? getCategoryByIndex(session.selectedCategoryIndex)
    : undefined;

  if (!category) {
    session.state = "browse_categories";
    return buildCategoriesPrompt();
  }

  const choice = parseChoice(text, category.items.length);
  if (!choice) {
    return `Opción inválida.\n\n${formatCategoryMenu(category)}`;
  }

  const item = getItemByIndex(category, choice);
  if (!item) {
    return `Opción inválida.\n\n${formatCategoryMenu(category)}`;
  }

  session.pendingItemIndex = choice;
  session.state = "enter_quantity";

  return `✅ *${item.name}* — ${formatCurrency(item.price)}

¿Cuántas unidades deseas?
Escribe un número (ej: 1, 2, 3)
*0* para volver a la categoría.`;
}

function handleEnterQuantity(session: UserSession, text: string): string {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    session.state = "browse_items";
    session.pendingItemIndex = undefined;

    const category = session.selectedCategoryIndex
      ? getCategoryByIndex(session.selectedCategoryIndex)
      : undefined;

    return category
      ? formatCategoryMenu(category)
      : buildCategoriesPrompt();
  }

  const quantity = Number(text.trim());
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    return "Cantidad inválida. Escribe un número entre 1 y 20.";
  }

  const category = session.selectedCategoryIndex
    ? getCategoryByIndex(session.selectedCategoryIndex)
    : undefined;
  const item =
    category && session.pendingItemIndex
      ? getItemByIndex(category, session.pendingItemIndex)
      : undefined;

  if (!item) {
    session.state = "browse_categories";
    return buildCategoriesPrompt();
  }

  addToCart(session, {
    itemId: item.id,
    name: item.name,
    unitPrice: item.price,
    quantity,
  });

  session.pendingItemIndex = undefined;
  session.state = "browse_categories";

  return `${formatCartSummary(session)}

¿Deseas agregar algo más?
Elige otra categoría o escribe *listo* para continuar.
*carrito* ver pedido · *0* menú principal.`;
}

async function handleChooseDelivery(
  session: UserSession,
  text: string,
): Promise<string> {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    session.state = "browse_categories";
    return buildCategoriesPrompt();
  }

  const choice = parseChoice(text, 2);
  if (!choice) {
    return `Elige una opción:\n\n1️⃣ Domicilio (+${formatCurrency(getDeliveryFee())})\n2️⃣ Recoger en local\n\n*0* para volver.`;
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
    return "📍 ¿Cuál es tu dirección de entrega?\n(Incluye barrio y referencia)";
  }

  session.state = "choose_payment";
  return proceedToPayment(session);
}

async function handleChooseSavedAddressFlow(
  session: UserSession,
  text: string,
): Promise<string> {
  const reply = await handleChooseSavedAddress(session, text);
  if (session.state === "choose_payment") {
    return reply || buildChoosePaymentPrompt(session);
  }
  return reply;
}

function handleEnterAddress(session: UserSession, text: string): string {
  const address = text.trim();
  if (address.length < 8) {
    return "Por favor escribe una dirección más completa (mínimo 8 caracteres).";
  }

  session.address = address;
  session.addressAlias = undefined;
  session.state = "save_address_prompt";

  return `📍 Dirección: ${address}

¿Guardar esta dirección para futuros pedidos?
Escribe un *alias* (ej: Casa, Trabajo) o *no* para continuar sin guardar.`;
}

async function handleSaveAddressPrompt(
  session: UserSession,
  text: string,
): Promise<string> {
  const normalized = normalizeText(text);

  if (normalized !== "no" && normalized !== "0") {
    const alias = text.trim();
    if (alias.length >= 2 && session.address && session.customerId) {
      try {
        const { addAddress } = await import("../customers/index.js");
        await addAddress(session.customerId, alias, session.address);
        session.addressAlias = alias;
      } catch {
        // alias duplicado o límite — continuar sin guardar
      }
    }
  }

  session.state = "choose_payment";
  return proceedToPayment(session);
}

async function handleConfirmOrder(
  session: UserSession,
  text: string,
): Promise<string> {
  const normalized = normalizeText(text);

  if (normalized === "0" || normalized === "no") {
    await resetSession(session.chatId);
    return "Pedido cancelado. Escribe *hola* cuando quieras volver.";
  }

  if (normalized !== "si" && normalized !== "sí" && normalized !== "confirmar") {
    return `${buildOrderConfirmation(session)}\n\nResponde *si* para confirmar o *no* para cancelar.`;
  }

  const customerId = await ensureSessionCustomer(session);
  const subtotal = calculateSubtotal(session.cart);
  const deliveryFee =
    session.deliveryType === "domicilio" ? getDeliveryFee() : 0;

  const order = await createOrder({
    chatId: session.chatId,
    customerId,
    customerName: session.customerName,
    items: session.cart.map((item) => ({ ...item })),
    deliveryType: session.deliveryType ?? "recoger",
    address: session.address,
    addressAlias: session.addressAlias,
    paymentMethod: session.paymentMethod,
    cashPaid: session.cashPaid,
    changeDue: session.changeDue,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    status: "pendiente",
  });

  await recordCustomerOrder(customerId);
  await resetSession(session.chatId);
  await notifyAdminNewOrder(order);
  void sendOrderReceipt(order);

  const deliveryLine =
    order.deliveryType === "domicilio"
      ? `📍 Domicilio${order.addressAlias ? ` (${order.addressAlias})` : ""}: ${order.address}`
      : "🏪 Recoger en local";

  const paymentLine = order.paymentMethod
    ? formatPaymentDetail(order.paymentMethod, order.cashPaid, order.changeDue)
    : "";

  return `✅ *Pedido #${order.id} registrado*

${formatOrderItems(order.items)}
${deliveryLine}
${paymentLine ? `\n${paymentLine}` : ""}

Subtotal: ${formatCurrency(order.subtotal)}
${deliveryFee > 0 ? `Domicilio: ${formatCurrency(deliveryFee)}\n` : ""}*Total: ${formatCurrency(order.total)}*

Estado: *Pendiente*
Te enviamos tu *comprobante en PDF* con código QR.

Puedes cancelarlo en *Mis pedidos* mientras esté pendiente.

Escribe *hola* para hacer otro pedido.`;
}

async function handleCheckOrderStatus(
  session: UserSession,
  text: string,
): Promise<{ reply: string; skipSave: boolean }> {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    await resetSession(session.chatId);
    return { reply: mainMenu(), skipSave: true };
  }

  const orders = await getActiveOrdersForChat(session.chatId);
  if (!orders.length) {
    await resetSession(session.chatId);
    return {
      reply: "No tienes pedidos registrados.\n\nEscribe *2* para hacer tu primer pedido.",
      skipSave: true,
    };
  }

  const choice = parseChoice(text, orders.length);
  if (choice) {
    const order = orders[choice - 1];
    session.selectedOrderId = order.id;
    session.state = "order_detail";
    return { reply: formatOrderDetailWithActions(order), skipSave: false };
  }

  return {
    reply: `${await formatOrderStatusList(session.chatId)}\n\nEscribe el *número* del pedido o *0* para volver.`,
    skipSave: false,
  };
}

async function handleOrderDetail(
  session: UserSession,
  text: string,
): Promise<{ reply: string; skipSave: boolean }> {
  const normalized = normalizeText(text);

  if (normalized === "0") {
    session.state = "check_order_status";
    session.selectedOrderId = undefined;
    return {
      reply: await formatOrderStatusList(session.chatId),
      skipSave: false,
    };
  }

  if (normalized === "cancelar") {
    const order = session.selectedOrderId
      ? await getOrder(session.selectedOrderId)
      : undefined;

    if (!order || order.status !== "pendiente") {
      return {
        reply: "Este pedido ya no se puede cancelar.",
        skipSave: false,
      };
    }

    session.state = "confirm_cancel_order";
    return {
      reply: `¿Confirmas cancelar el *pedido #${order.id}*?\n\nResponde *si* o *no*.`,
      skipSave: false,
    };
  }

  const order = session.selectedOrderId
    ? await getOrder(session.selectedOrderId)
    : undefined;

  return {
    reply: order
      ? `${formatOrderDetailWithActions(order)}\n\nEscribe *cancelar* para cancelar (solo pendientes) o *0* para volver.`
      : await formatOrderStatusList(session.chatId),
    skipSave: false,
  };
}

async function handleConfirmCancelOrder(
  session: UserSession,
  text: string,
): Promise<{ reply: string; skipSave: boolean }> {
  const normalized = normalizeText(text);
  const orderId = session.selectedOrderId;

  if (normalized === "no" || normalized === "0") {
    session.state = "order_detail";
    const order = orderId ? await getOrder(orderId) : undefined;
    return {
      reply: order
        ? formatOrderDetailWithActions(order)
        : await formatOrderStatusList(session.chatId),
      skipSave: false,
    };
  }

  if (normalized !== "si" && normalized !== "sí") {
    return {
      reply: "Responde *si* para confirmar la cancelación o *no* para volver.",
      skipSave: false,
    };
  }

  if (!orderId) {
    await resetSession(session.chatId);
    return { reply: mainMenu(), skipSave: true };
  }

  const cancelled = await cancelOrder(orderId, "cliente");
  if (!cancelled) {
    return {
      reply: "❌ No se pudo cancelar. Solo se pueden cancelar pedidos *pendientes*.",
      skipSave: false,
    };
  }

  await notifyAdminOrderCancelled(cancelled);
  await resetSession(session.chatId);

  return {
    reply: `❌ *Pedido #${orderId} cancelado.*

Si deseas, puedes hacer un nuevo pedido escribiendo *hola*.`,
    skipSave: true,
  };
}

async function getActiveOrdersForChat(chatId: string): Promise<Order[]> {
  const orders = await getOrdersForChat(chatId);
  return orders.filter((order) => order.status !== "cancelado").slice(0, 5);
}

function clearOrderingFields(session: UserSession): void {
  session.cart = [];
  session.selectedCategoryIndex = undefined;
  session.pendingItemIndex = undefined;
  session.deliveryType = undefined;
  session.address = undefined;
  session.addressAlias = undefined;
  session.pendingAddressAlias = undefined;
  session.pendingAddressLine = undefined;
}

function addToCart(session: UserSession, item: CartItem): void {
  const existing = session.cart.find((entry) => entry.itemId === item.itemId);
  if (existing) {
    existing.quantity += item.quantity;
    return;
  }
  session.cart.push(item);
}

function calculateSubtotal(cart: CartItem[]): number {
  return cart.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0,
  );
}

function formatCartSummary(session: UserSession): string {
  if (!session.cart.length) {
    return "🛒 Tu pedido está vacío.";
  }

  const lines = ["🛒 *Tu pedido actual:*\n"];
  for (const item of session.cart) {
    lines.push(
      `• ${item.quantity}x ${item.name} — ${formatCurrency(item.unitPrice * item.quantity)}`,
    );
  }
  lines.push(`\nSubtotal: *${formatCurrency(calculateSubtotal(session.cart))}*`);
  return lines.join("\n");
}

function buildOrderConfirmation(session: UserSession): string {
  const subtotal = calculateSubtotal(session.cart);
  const deliveryFee =
    session.deliveryType === "domicilio" ? getDeliveryFee() : 0;

  const lines = [
    "📋 *Confirma tu pedido*\n",
    formatOrderItems(session.cart),
    "",
    session.deliveryType === "domicilio"
      ? `📍 Domicilio${session.addressAlias ? ` (${session.addressAlias})` : ""}: ${session.address}`
      : "🏪 Recoger en local",
  ];

  if (session.paymentMethod) {
    lines.push(
      "",
      formatPaymentDetail(
        session.paymentMethod,
        session.cashPaid,
        session.changeDue,
      ),
    );
  }

  lines.push(
    "",
    `Subtotal: ${formatCurrency(subtotal)}`,
  );

  if (deliveryFee > 0) {
    lines.push(`Costo domicilio: ${formatCurrency(deliveryFee)}`);
  }

  lines.push(`*Total: ${formatCurrency(subtotal + deliveryFee)}*`);
  lines.push("\nResponde *si* para confirmar o *no* para cancelar.");

  return lines.join("\n");
}

function formatOrderItems(
  items: Array<{ quantity: number; name: string; unitPrice: number }>,
): string {
  return items
    .map(
      (item) =>
        `• ${item.quantity}x ${item.name} — ${formatCurrency(item.unitPrice * item.quantity)}`,
    )
    .join("\n");
}

function statusLabel(status: Order["status"]): string {
  return {
    pendiente: "⏳ Pendiente",
    confirmado: "👨‍🍳 En preparación",
    entregado: "✅ Entregado",
    cancelado: "❌ Cancelado",
  }[status];
}

function formatSingleOrder(order: Order): string {
  const deliveryLine =
    order.deliveryType === "domicilio"
      ? `📍 ${order.addressAlias ? `${order.addressAlias}: ` : ""}${order.address}`
      : "🏪 Recoger en local";

  const paymentLine = order.paymentMethod
    ? formatPaymentDetail(order.paymentMethod, order.cashPaid, order.changeDue)
    : "";

  const lines = [
    `📦 *Pedido #${order.id}*`,
    `Estado: ${statusLabel(order.status)}`,
    deliveryLine,
  ];

  if (paymentLine) {
    lines.push(paymentLine);
  }

  lines.push(
    "",
    formatOrderItems(order.items),
    "",
    `Total: *${formatCurrency(order.total)}*`,
    `Fecha: ${order.createdAt.toLocaleString("es-PE")}`,
  );

  return lines.join("\n");
}

function formatOrderDetailWithActions(order: Order): string {
  const detail = formatSingleOrder(order);
  if (order.status === "pendiente") {
    return `${detail}\n\n_Escribe *cancelar* para cancelar este pedido o *0* para volver._`;
  }
  return `${detail}\n\n_Escribe *0* para volver._`;
}

async function formatOrderStatusList(chatId: string): Promise<string> {
  const orders = await getActiveOrdersForChat(chatId);
  if (!orders.length) {
    return "No tienes pedidos registrados.";
  }

  const lines = ["📦 *Tus pedidos recientes:*\n"];
  orders.forEach((order, index) => {
    lines.push(
      `${index + 1}. #${order.id} — ${order.status} — ${formatCurrency(order.total)}`,
    );
  });

  lines.push("\nEscribe el *número* para ver detalle o *0* para volver.");
  return lines.join("\n");
}

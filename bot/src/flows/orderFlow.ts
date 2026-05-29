import { recordCustomerOrder } from "../customers/index.js";
import { getMenu, getCategoryByIndex, getItemByIndex } from "../menu/data.js";
import {
  formatCategoryMenu,
  formatMenuItemDetail,
  formatMenuOverview,
} from "../menu/format.js";
import {
  calculateSubtotal,
  formatBrowseCategoriesPrompt,
  formatChooseDeliveryPrompt,
} from "./orderPrompts.js";
import {
  handleAfterAddToCart,
  handleBrowseCategories,
  handleBrowseItems,
  handleCartMenu,
  handleChooseDelivery,
  handleChoosePayment,
  handleChooseSavedAddressFlow,
  handleEnterAddress,
  handleEnterCashAmount,
  handleEnterQuantity,
  handleSaveAddressPrompt,
} from "./orderFlowOrder.js";
import { resumePromptForState } from "./orderNavigation.js";
import {
  cancelOrder,
  createOrder,
  getOrder,
  getOrdersForChat,
  type Order,
} from "../orders/index.js";
import { formatPaymentDetail } from "../orders/payment.js";
import { notifyAdminNewOrder, notifyAdminOrderCancelled } from "../notifications/admin.js";
import { sendOrderReceipt } from "../notifications/receipt.js";
import {
  buildProfileMenu,
  buildRegistrationPrompt,
  ensureSessionCustomer,
  formatSavedAddressChoice,
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
  getSessionForChat,
  resetSession,
  saveSession,
  clearSessionFields,
  expireSessionIfIdle,
  formatSessionExpiredMessage,
  formatSessionWarningMessage,
  checkSessionIdle,
  markInactivityWarningSent,
  resumeAfterInactivity,
  isInactivityContinueCommand,
  isInactivityCancelCommand,
  touchSession,
  type UserSession,
} from "../session/index.js";
import { formatCurrency, normalizeText, parseChoice } from "../utils/format.js";
import { config } from "../config.js";

function getSessionInactivityMinutes(): number {
  return config.session.inactivityMinutes;
}

function getSessionWarningMinutes(): number {
  return config.session.warningMinutes;
}

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

• *hola* o *menu* → volver al inicio
• Durante un pedido:
  · *9* o *carrito* → ver tu carrito
  · *continuar* → pasar al pago (si ya tienes platos)
  · *0* → volver al paso anterior
• *cancelar* → aborta el pedido en curso
• Tras *${getSessionWarningMinutes()} min* sin escribir te preguntamos si sigues; a los *${getSessionInactivityMinutes()} min* se cancela solo
• Pedidos *pendientes* se cancelan en *Mis pedidos*

Horario: ${profile.schedule}
Domicilio: ${profile.deliveryZone}`;
}

export async function handleIncomingMessage(
  chatId: string,
  text: string,
  customerName?: string,
): Promise<string> {
  const session = await getSessionForChat(chatId);
  if (customerName) {
    session.whatsappName = customerName;
  }

  const existingCustomer = await getCustomerByChatId(session.chatId);
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

    if (await shouldPromptRegistration(session.chatId)) {
      session.state = "register_prompt";
      reply = buildRegistrationPrompt(session.whatsappName);
    } else {
      reply = mainMenu();
    }

    touchSession(session);
    await saveSession(session);
    return reply;
  }

  if (session.awaitingInactivityConfirm) {
    reply = await handleInactivityConfirm(session, normalized);
    touchSession(session);
    await saveSession(session);
    return reply;
  }

  if (checkSessionIdle(session) === "warn") {
    markInactivityWarningSent(session);
    await saveSession(session);
    return formatSessionWarningMessage();
  }

  if (expireSessionIfIdle(session)) {
    await saveSession(session);
    return `${formatSessionExpiredMessage()}\n\n${mainMenu()}`;
  }

  if (normalized === "cancelar" && session.state !== "main_menu") {
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
      await resetSession(session.chatId);
      skipSave = true;
      reply = "Pedido cancelado. Escribe *hola* cuando quieras volver a pedir.";
    }
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
        reply = handleBrowseCategories(session, text, mainMenu);
        break;
      case "browse_items":
        reply = handleBrowseItems(session, text, mainMenu);
        break;
      case "enter_quantity":
        reply = handleEnterQuantity(session, text, mainMenu);
        break;
      case "after_add_to_cart":
        reply = handleAfterAddToCart(session, text, mainMenu);
        break;
      case "cart_menu":
        reply = handleCartMenu(session, text, mainMenu);
        break;
      case "choose_delivery":
        reply = await handleChooseDelivery(session, text, mainMenu, proceedToPayment);
        break;
      case "choose_saved_address":
        reply = await handleChooseSavedAddressFlow(
          session,
          text,
          mainMenu,
          buildChoosePaymentPrompt,
        );
        break;
      case "enter_address":
        reply = handleEnterAddress(session, text);
        break;
      case "save_address_prompt":
        reply = await handleSaveAddressPrompt(session, text, proceedToPayment);
        break;
      case "choose_payment":
        reply = handleChoosePayment(
          session,
          text,
          buildChoosePaymentPrompt,
          buildEnterCashPrompt,
          buildOrderConfirmation,
        );
        break;
      case "enter_cash_amount":
        reply = handleEnterCashAmount(
          session,
          text,
          calculateOrderTotal(session),
          buildChoosePaymentPrompt,
          buildEnterCashPrompt,
          buildOrderConfirmation,
        );
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
          reply = `${intro}${formatBrowseCategoriesPrompt(session)}`;
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
        await resetSession(session.chatId);
        skipSave = true;
        reply = mainMenu();
    }
  }

  if (!skipSave) {
    touchSession(session);
    await saveSession(session);
  }

  return reply;
}

async function handleInactivityConfirm(
  session: UserSession,
  normalized: string,
): Promise<string> {
  if (isInactivityContinueCommand(normalized)) {
    resumeAfterInactivity(session);
    return `✅ Perfecto, seguimos.\n\n${await buildResumePrompt(session)}`;
  }

  if (isInactivityCancelCommand(normalized)) {
    clearSessionFields(session);
    return `Pedido cancelado.\n\n${mainMenu()}`;
  }

  return `${formatSessionWarningMessage()}\n\n_No entendí. Responde *1* para continuar o *0* para cancelar._`;
}

async function buildResumePrompt(session: UserSession): Promise<string> {
  const orderResume = resumePromptForState(session, session.state);
  if (orderResume) {
    return orderResume;
  }

  switch (session.state) {
    case "choose_saved_address":
      if (session.customerId) {
        return await formatSavedAddressChoice(session.customerId);
      }
      return formatChooseDeliveryPrompt(session);
    case "enter_address":
      return "📍 ¿Cuál es tu dirección de entrega?\n(Incluye barrio y referencia)";
    case "save_address_prompt":
      return session.address
        ? `📍 Dirección: ${session.address}\n\n¿Guardar esta dirección para futuros pedidos?\nEscribe un *alias* (ej: Casa, Trabajo) o *no* para continuar sin guardar.`
        : formatChooseDeliveryPrompt(session);
    case "choose_payment":
      return buildChoosePaymentPrompt(session);
    case "enter_cash_amount":
      return buildEnterCashPrompt(session);
    case "confirm_order":
      return buildOrderConfirmation(session);
    case "view_menu_categories":
      return formatMenuOverview(getMenu().categories);
    case "view_menu_items": {
      const category = session.selectedCategoryIndex
        ? getCategoryByIndex(session.selectedCategoryIndex)
        : undefined;
      return category
        ? formatCategoryMenu(category, { mode: "view" })
        : formatMenuOverview(getMenu().categories);
    }
    case "check_order_status":
      return await formatOrderStatusList(session.chatId);
    case "order_detail":
    case "confirm_cancel_order": {
      const order = session.selectedOrderId
        ? await getOrder(session.selectedOrderId)
        : undefined;
      return order
        ? formatOrderDetailWithActions(order)
        : await formatOrderStatusList(session.chatId);
    }
    case "profile_menu":
      return await buildProfileMenu(session);
    case "register_prompt":
      return buildRegistrationPrompt(session.whatsappName);
    case "register_name":
      return "¿Cuál es tu nombre? (Ej: Juan Pérez)";
    default:
      return mainMenu();
  }
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
      return formatBrowseCategoriesPrompt(session);
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
    return formatBrowseCategoriesPrompt(session);
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
    return formatBrowseCategoriesPrompt(session);
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

import { listAddresses, recordCustomerOrder } from "../customers/index.js";
import { getMenu, getCategoryByIndex, getItemByIndex } from "../menu/data.js";
import {
  formatCategoryMenu,
  formatFullMenu,
} from "../menu/format.js";
import {
  cancelOrder,
  createOrder,
  getOrder,
  getOrdersForChat,
  type Order,
} from "../orders/index.js";
import { notifyAdminNewOrder, notifyAdminOrderCancelled } from "../notifications/admin.js";
import {
  buildProfileMenu,
  ensureSessionCustomer,
  formatSavedAddressChoice,
  handleChooseSavedAddress,
  handleProfileFlow,
} from "../flows/profileFlow.js";
import {
  getDeliveryFee,
  getRestaurantName,
  getRestaurantProfile,
} from "../restaurant/profile.js";
import {
  getSession,
  resetSession,
  saveSession,
  type CartItem,
  type UserSession,
} from "../session/index.js";
import { formatCurrency, normalizeText, parseChoice } from "../utils/format.js";

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
• Durante un pedido, *0* te lleva un paso atrás
• *cancelar* aborta el pedido en curso (carrito)
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
    session.customerName = customerName;
  }
  await ensureSessionCustomer(session, customerName);

  const normalized = normalizeText(text);

  let skipSave = false;
  let reply: string;

  if (isGlobalCommand(normalized)) {
    await resetSession(chatId);
    skipSave = true;
    reply = mainMenu();
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
      reply = mainMenu();
    } else {
      await resetSession(chatId);
      skipSave = true;
      reply = "Pedido cancelado. Escribe *hola* cuando quieras volver a pedir.";
    }
  } else {
    switch (session.state) {
      case "main_menu":
        reply = await handleMainMenu(session, text);
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
      case "profile_menu":
      case "edit_name":
      case "address_menu":
      case "add_address_alias":
      case "add_address_line": {
        const profileResult = await handleProfileFlow(session, text);
        reply = profileResult.done ? mainMenu() : profileResult.reply;
        if (profileResult.done) {
          skipSave = true;
        }
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

function isProfileState(state: UserSession["state"]): boolean {
  return [
    "profile_menu",
    "edit_name",
    "address_menu",
    "add_address_alias",
    "add_address_line",
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
      return `${formatFullMenu(getMenu().categories)}\n\nEscribe *2* para hacer un pedido.`;
    case 2:
      session.state = "browse_categories";
      return buildCategoriesPrompt(true);
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

function buildCategoriesPrompt(isOrdering: boolean): string {
  const menu = getMenu();
  const lines = [
    isOrdering ? "🛒 *Nuevo pedido*\n" : "📂 *Categorías*\n",
  ];

  menu.categories.forEach((category, index) => {
    lines.push(`${index + 1}. ${category.name}`);
  });

  lines.push("\nElige una categoría escribiendo su *número*.");
  lines.push("Escribe *0* para volver al menú principal.");
  return lines.join("\n");
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

*0* para volver.`;
  }

  const menu = getMenu();
  const choice = parseChoice(text, menu.categories.length);
  if (!choice) {
    return `Opción inválida.\n\n${buildCategoriesPrompt(true)}`;
  }

  const category = getCategoryByIndex(choice);
  if (!category) {
    return `Opción inválida.\n\n${buildCategoriesPrompt(true)}`;
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
    return buildCategoriesPrompt(true);
  }

  const category = session.selectedCategoryIndex
    ? getCategoryByIndex(session.selectedCategoryIndex)
    : undefined;

  if (!category) {
    session.state = "browse_categories";
    return buildCategoriesPrompt(true);
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
      : buildCategoriesPrompt(true);
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
    return buildCategoriesPrompt(true);
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
*0* vuelve al menú principal.`;
}

async function handleChooseDelivery(
  session: UserSession,
  text: string,
): Promise<string> {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    session.state = "browse_categories";
    return buildCategoriesPrompt(true);
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

  session.state = "confirm_order";
  return buildOrderConfirmation(session);
}

async function handleChooseSavedAddressFlow(
  session: UserSession,
  text: string,
): Promise<string> {
  const reply = await handleChooseSavedAddress(session, text);
  if (session.state === "confirm_order") {
    return reply || buildOrderConfirmation(session);
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

  session.state = "confirm_order";
  return buildOrderConfirmation(session);
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
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    status: "pendiente",
  });

  await recordCustomerOrder(customerId);
  await resetSession(session.chatId);
  await notifyAdminNewOrder(order);

  const deliveryLine =
    order.deliveryType === "domicilio"
      ? `📍 Domicilio${order.addressAlias ? ` (${order.addressAlias})` : ""}: ${order.address}`
      : "🏪 Recoger en local";

  return `✅ *Pedido #${order.id} registrado*

${formatOrderItems(order.items)}
${deliveryLine}

Subtotal: ${formatCurrency(order.subtotal)}
${deliveryFee > 0 ? `Domicilio: ${formatCurrency(deliveryFee)}\n` : ""}*Total: ${formatCurrency(order.total)}*

Estado: *Pendiente*
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
    "",
    `Subtotal: ${formatCurrency(subtotal)}`,
  ];

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

  return `📦 *Pedido #${order.id}*
Estado: ${statusLabel(order.status)}
${deliveryLine}

${formatOrderItems(order.items)}

Total: *${formatCurrency(order.total)}*
Fecha: ${order.createdAt.toLocaleString("es-PE")}`;
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

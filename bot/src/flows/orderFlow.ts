import { config } from "../config.js";
import {
  formatCategoryMenu,
  formatFullMenu,
  getCategoryByIndex,
  getItemByIndex,
  getMenu,
} from "../menu/loader.js";
import { createOrder, getLatestOrder, getOrdersForChat } from "../orders/store.js";
import {
  getSession,
  resetSession,
  type CartItem,
  type UserSession,
} from "../session/store.js";
import { formatCurrency, normalizeText, parseChoice } from "../utils/format.js";

function mainMenu(): string {
  return `¡Hola! Bienvenido a *${config.restaurantName}* 🍽️

¿Qué deseas hacer?

1️⃣ Ver carta completa
2️⃣ Hacer un pedido
3️⃣ Estado de mi pedido
4️⃣ Ayuda

Escribe el *número* de la opción.`;
}

const HELP_TEXT = `ℹ️ *Ayuda*

• Escribe *hola* o *menu* para volver al inicio
• Durante un pedido, *0* te lleva un paso atrás
• *cancelar* aborta el pedido actual

Horario: Lun–Dom 11:00 – 22:00
Domicilio disponible en la zona centro.`;

export function handleIncomingMessage(
  chatId: string,
  text: string,
  customerName?: string,
): string {
  const session = getSession(chatId);
  if (customerName) {
    session.customerName = customerName;
  }

  const normalized = normalizeText(text);

  if (isGlobalCommand(normalized)) {
    resetSession(chatId);
    return mainMenu();
  }

  if (normalized === "cancelar" && session.state !== "main_menu") {
    resetSession(chatId);
    return "Pedido cancelado. Escribe *hola* cuando quieras volver a pedir.";
  }

  switch (session.state) {
    case "main_menu":
      return handleMainMenu(session, text);
    case "browse_categories":
      return handleBrowseCategories(session, text);
    case "browse_items":
      return handleBrowseItems(session, text);
    case "enter_quantity":
      return handleEnterQuantity(session, text);
    case "choose_delivery":
      return handleChooseDelivery(session, text);
    case "enter_address":
      return handleEnterAddress(session, text);
    case "confirm_order":
      return handleConfirmOrder(session, text);
    case "check_order_status":
      return handleCheckOrderStatus(session, text);
    default:
      resetSession(chatId);
      return mainMenu();
  }
}

function isGlobalCommand(text: string): boolean {
  return ["hola", "menu", "inicio", "start", "hi", "hello"].includes(text);
}

function handleMainMenu(session: UserSession, text: string): string {
  const choice = parseChoice(text, 4);
  if (!choice) {
    return `No entendí esa opción.\n\n${mainMenu()}`;
  }

  switch (choice) {
    case 1:
      return `${formatFullMenu()}\n\nEscribe *2* para hacer un pedido.`;
    case 2:
      session.state = "browse_categories";
      return buildCategoriesPrompt(true);
    case 3:
      session.state = "check_order_status";
      return formatOrderStatusList(session.chatId);
    case 4:
      return HELP_TEXT;
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
    resetSession(session.chatId);
    return mainMenu();
  }

  if (normalized === "listo") {
    if (!session.cart.length) {
      return "Tu pedido está vacío. Elige al menos un plato antes de continuar.";
    }
    session.state = "choose_delivery";
    return `🚚 ¿Cómo deseas recibir tu pedido?

1️⃣ Domicilio (+${formatCurrency(config.deliveryFee)})
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

function handleChooseDelivery(session: UserSession, text: string): string {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    session.state = "browse_categories";
    return buildCategoriesPrompt(true);
  }

  const choice = parseChoice(text, 2);
  if (!choice) {
    return `Elige una opción:\n\n1️⃣ Domicilio (+${formatCurrency(config.deliveryFee)})\n2️⃣ Recoger en local\n\n*0* para volver.`;
  }

  session.deliveryType = choice === 1 ? "domicilio" : "recoger";

  if (session.deliveryType === "domicilio") {
    session.state = "enter_address";
    return "📍 ¿Cuál es tu dirección de entrega?\n(Incluye barrio y referencia)";
  }

  session.state = "confirm_order";
  return buildOrderConfirmation(session);
}

function handleEnterAddress(session: UserSession, text: string): string {
  const address = text.trim();
  if (address.length < 8) {
    return "Por favor escribe una dirección más completa (mínimo 8 caracteres).";
  }

  session.address = address;
  session.state = "confirm_order";
  return buildOrderConfirmation(session);
}

function handleConfirmOrder(session: UserSession, text: string): string {
  const normalized = normalizeText(text);

  if (normalized === "0" || normalized === "no") {
    resetSession(session.chatId);
    return "Pedido cancelado. Escribe *hola* cuando quieras volver.";
  }

  if (normalized !== "si" && normalized !== "sí" && normalized !== "confirmar") {
    return `${buildOrderConfirmation(session)}\n\nResponde *si* para confirmar o *no* para cancelar.`;
  }

  const subtotal = calculateSubtotal(session.cart);
  const deliveryFee =
    session.deliveryType === "domicilio" ? config.deliveryFee : 0;

  const order = createOrder({
    chatId: session.chatId,
    customerName: session.customerName,
    items: session.cart.map((item) => ({ ...item })),
    deliveryType: session.deliveryType ?? "recoger",
    address: session.address,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    status: "pendiente",
  });

  resetSession(session.chatId);

  const deliveryLine =
    order.deliveryType === "domicilio"
      ? `📍 Domicilio: ${order.address}`
      : "🏪 Recoger en local";

  return `✅ *Pedido #${order.id} registrado*

${formatOrderItems(order.items)}
${deliveryLine}

Subtotal: ${formatCurrency(order.subtotal)}
${deliveryFee > 0 ? `Domicilio: ${formatCurrency(deliveryFee)}\n` : ""}*Total: ${formatCurrency(order.total)}*

Estado: *Pendiente*
Te avisaremos cuando esté listo.

Escribe *hola* para hacer otro pedido.`;
}

function handleCheckOrderStatus(session: UserSession, text: string): string {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    resetSession(session.chatId);
    return mainMenu();
  }

  const orders = getOrdersForChat(session.chatId);
  if (!orders.length) {
    resetSession(session.chatId);
    return "No tienes pedidos registrados.\n\nEscribe *2* para hacer tu primer pedido.";
  }

  const choice = parseChoice(text, orders.length);
  if (choice) {
    const order = orders[choice - 1];
    resetSession(session.chatId);
    return formatSingleOrder(order);
  }

  return `${formatOrderStatusList(session.chatId)}\n\nEscribe el *número* del pedido o *0* para volver.`;
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
    session.deliveryType === "domicilio" ? config.deliveryFee : 0;

  const lines = [
    "📋 *Confirma tu pedido*\n",
    formatOrderItems(session.cart),
    "",
    session.deliveryType === "domicilio"
      ? `📍 Domicilio: ${session.address}`
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

function formatSingleOrder(
  order: NonNullable<ReturnType<typeof getLatestOrder>>,
): string {
  const statusLabel = {
    pendiente: "⏳ Pendiente",
    confirmado: "👨‍🍳 En preparación",
    entregado: "✅ Entregado",
  }[order.status];

  const deliveryLine =
    order.deliveryType === "domicilio"
      ? `📍 ${order.address}`
      : "🏪 Recoger en local";

  return `📦 *Pedido #${order.id}*
Estado: ${statusLabel}
${deliveryLine}

${formatOrderItems(order.items)}

Total: *${formatCurrency(order.total)}*
Fecha: ${order.createdAt.toLocaleString("es-CO")}`;
}

function formatOrderStatusList(chatId: string): string {
  const orders = getOrdersForChat(chatId);
  if (!orders.length) {
    return "No tienes pedidos registrados.";
  }

  const lines = ["📦 *Tus pedidos recientes:*\n"];
  orders.slice(0, 5).forEach((order, index) => {
    lines.push(
      `${index + 1}. #${order.id} — ${order.status} — ${formatCurrency(order.total)}`,
    );
  });

  lines.push("\nEscribe el *número* para ver detalle o *0* para volver.");
  return lines.join("\n");
}

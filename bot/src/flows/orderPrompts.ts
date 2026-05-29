import { getMenu } from "../menu/data.js";
import { formatCategoryMenu, formatMenuOverview } from "../menu/format.js";
import type { CartItem, UserSession } from "../session/types.js";
import { formatCurrency, normalizeText } from "../utils/format.js";
import { getDeliveryFee } from "../restaurant/profile.js";

const DIVIDER = "────────────────";

export function isViewCartCommand(text: string): boolean {
  const n = normalizeText(text);
  return n === "9" || n === "carrito" || n === "ver carrito" || n === "mi carrito";
}

export function isFinishOrderCommand(text: string): boolean {
  const n = normalizeText(text);
  return ["continuar", "listo", "terminar", "siguiente"].includes(n);
}

export function calculateSubtotal(cart: CartItem[]): number {
  return cart.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0,
  );
}

export function formatCartBadge(session: UserSession): string {
  if (!session.cart.length) {
    return "🛒 *Carrito vacío* — agrega platos para continuar";
  }
  const items = session.cart.reduce((n, item) => n + item.quantity, 0);
  const subtotal = calculateSubtotal(session.cart);
  const label = items === 1 ? "1 plato" : `${items} platos`;
  return `🛒 *Carrito:* ${label} · *${formatCurrency(subtotal)}*`;
}

export function formatCartDetail(session: UserSession): string {
  if (!session.cart.length) {
    return "🛒 *Tu carrito está vacío*\n\nElige una categoría y agrega platos.";
  }

  const lines = ["🛒 *Tu pedido*", DIVIDER, ""];

  session.cart.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.quantity}× ${item.name}`,
      `   ${formatCurrency(item.unitPrice * item.quantity)}`,
    );
  });

  lines.push(
    DIVIDER,
    `*Subtotal: ${formatCurrency(calculateSubtotal(session.cart))}*`,
  );
  return lines.join("\n");
}

export function formatOrderBrowseHelp(session: UserSession): string {
  const lines = [
    "",
    DIVIDER,
    "📌 *Atajos:*",
    "• Número → elegir categoría o plato",
    "• *9* → ver carrito",
    "• *0* → volver / salir",
  ];
  if (session.cart.length > 0) {
    lines.push("• *continuar* → pasar al pago");
  }
  return lines.join("\n");
}

export function formatBrowseCategoriesPrompt(session: UserSession): string {
  const menu = getMenu();
  const lines = [
    "🛍️ *Arma tu pedido — Paso 1*",
    "",
    formatCartBadge(session),
    "",
    "*Elige una categoría:*",
    "",
  ];

  menu.categories.forEach((category, index) => {
    lines.push(`${index + 1}. ${category.name}`);
  });

  lines.push(formatOrderBrowseHelp(session));
  return lines.join("\n");
}

export function formatCategoryBrowseFooter(): string {
  return [
    "",
    DIVIDER,
    "• Número → agregar plato",
    "• *9* → ver carrito",
    "• *0* → volver a categorías",
  ].join("\n");
}

export function formatCategoryMenuForOrder(
  session: UserSession,
  categoryIndex: number,
): string {
  const category = getMenu().categories[categoryIndex - 1];
  if (!category) {
    return formatBrowseCategoriesPrompt(session);
  }
  return `${formatCartBadge(session)}\n\n${formatCategoryMenu(category, { footer: false })}${formatCategoryBrowseFooter()}`;
}

export function formatCartMenu(session: UserSession): string {
  const lines = [formatCartDetail(session), ""];

  if (!session.cart.length) {
    lines.push(
      "_El carrito está vacío — agrega platos para continuar._",
      "",
      "1️⃣ Agregar platos",
      "0️⃣ Volver",
    );
    return lines.join("\n");
  }

  lines.push(
    "¿Qué deseas hacer?",
    "",
    "1️⃣ Agregar más platos",
    "2️⃣ Continuar con el pedido",
    "3️⃣ Vaciar carrito",
    "0️⃣ Volver",
  );
  return lines.join("\n");
}

export function formatAfterAddToCart(session: UserSession): string {
  return [
    "✅ *¡Agregado al carrito!*",
    "",
    formatCartDetail(session),
    "",
    "¿Seguimos?",
    "",
    "1️⃣ Agregar otro plato",
    "2️⃣ Continuar con el pedido",
    "9️⃣ Ver carrito completo",
    "",
    "_También puedes escribir el *número* de una categoría para agregar otro plato._",
  ].join("\n");
}

export function formatChooseDeliveryPrompt(session: UserSession): string {
  return [
    "📦 *Paso 2 — ¿Cómo lo recibes?*",
    "",
    formatCartBadge(session),
    "",
    `1️⃣ Domicilio (+${formatCurrency(getDeliveryFee())})`,
    "2️⃣ Recoger en local",
    "",
    "*0* ← volver al carrito",
  ].join("\n");
}

export function formatQuantityPrompt(itemName: string, price: number): string {
  return [
    `🍽️ *${itemName}*`,
    `Precio: *${formatCurrency(price)}*`,
    "",
    "¿Cuántos deseas?",
    "Escribe un número del *1* al *20*",
    "",
    "*0* ← volver a la lista de platos",
  ].join("\n");
}

export function formatEmptyCartMessage(): string {
  return "Tu carrito está vacío. Elige una categoría y agrega al menos un plato.\n\n*9* ver carrito · *0* menú principal";
}

export function formatMenuOverviewForBrowse(): string {
  return formatMenuOverview(getMenu().categories, {
    title: "📋 *Ver carta*",
    footer: "_Elige categoría para explorar._\n*0* Menú · *2* Hacer pedido",
  });
}

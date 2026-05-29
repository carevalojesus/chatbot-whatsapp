import { formatCurrency } from "../utils/format.js";
import type { MenuCategory, MenuItem } from "./types.js";

const CATEGORY_EMOJI: Record<string, string> = {
  ceviches: "🐟",
  tiraditos: "🍣",
  entradas: "🍤",
  causas: "🥔",
  calientes: "🔥",
  guarniciones: "🌽",
  bebidas: "🥤",
  postres: "🍮",
};

const DIVIDER = "────────────────";

function categoryEmoji(category: MenuCategory): string {
  return CATEGORY_EMOJI[category.id] ?? "🍽️";
}

function priceRange(category: MenuCategory): string {
  const prices = category.items.map((item) => item.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  if (min === max) {
    return formatCurrency(min);
  }

  return `${formatCurrency(min)} – ${formatCurrency(max)}`;
}

function formatItemBlock(index: number, item: MenuItem): string {
  return [
    `*${index}.* ${item.name}`,
    `    _${item.description}_`,
    `    💰 *${formatCurrency(item.price)}*`,
  ].join("\n");
}

export function formatMenuItemDetail(item: MenuItem): string {
  return [
    `🍽️ *${item.name}*`,
    DIVIDER,
    `_${item.description}_`,
    "",
    `💰 *${formatCurrency(item.price)}*`,
    "",
    DIVIDER,
    "_Para pedir, escribe *2* en el menú principal._",
    "*0* ← Volver a la categoría",
  ].join("\n");
}

export function formatMenuOverview(
  categories: MenuCategory[],
  options?: { title?: string; footer?: string },
): string {
  const title = options?.title ?? "📋 *Nuestra carta*";
  const footer =
    options?.footer ??
    "_Elige una categoría para ver los platos._\n*0* Menú principal · *2* Hacer pedido";

  const lines = [title, ""];

  categories.forEach((category, index) => {
    const emoji = categoryEmoji(category);
    const count = category.items.length;
    const platos = count === 1 ? "1 plato" : `${count} platos`;

    lines.push(`${index + 1}️⃣ ${emoji} *${category.name}*`);
    lines.push(`   ${platos} · ${priceRange(category)}`);
    lines.push("");
  });

  lines.push(footer);
  return lines.join("\n").trim();
}

export function formatCategoryMenu(
  category: MenuCategory,
  options?: { mode?: "order" | "view"; footer?: string | false },
): string {
  const mode = options?.mode ?? "order";
  const emoji = categoryEmoji(category);
  const lines = [`${emoji} *${category.name}*`, DIVIDER, ""];

  category.items.forEach((item, index) => {
    lines.push(formatItemBlock(index + 1, item));
    lines.push("");
  });

  lines.push(DIVIDER);

  if (options?.footer === false) {
    return lines.join("\n");
  }

  const customFooter = options?.footer;
  if (typeof customFooter === "string") {
    lines.push(customFooter);
  } else if (mode === "view") {
    lines.push("_Explora los platos de esta categoría._");
    lines.push("*0* ← Categorías · *2* Hacer pedido");
  } else {
    lines.push("_Escribe el *número* del plato que deseas._");
    lines.push("*9* carrito · *ok* continuar · *0* categorías");
  }

  return lines.join("\n");
}

/** @deprecated Usar formatMenuOverview + navegación por categoría */
export function formatFullMenu(categories: MenuCategory[]): string {
  return formatMenuOverview(categories, {
    title: "📋 *Carta completa*",
    footer: "_Elige una categoría para ver los platos._",
  });
}

/** @deprecated Usar formatBrowseCategoriesPrompt de orderPrompts */
export function formatOrderCategoriesPrompt(categories: MenuCategory[]): string {
  return formatMenuOverview(categories, {
    title: "🛒 *Nuevo pedido*\n\nElige una categoría:",
    footer:
      "_Escribe el número de la categoría._\n*9* carrito · *ok* continuar · *0* menú",
  });
}

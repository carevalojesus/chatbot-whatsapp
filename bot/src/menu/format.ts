import { formatCurrency } from "../utils/format.js";
import type { MenuCategory } from "./types.js";

export function formatFullMenu(categories: MenuCategory[]): string {
  const lines = ["📋 *Carta completa*\n"];

  for (const category of categories) {
    lines.push(`*${category.name}*`);
    category.items.forEach((item, index) => {
      lines.push(
        `${index + 1}. ${item.name} — ${formatCurrency(item.price)}`,
      );
      lines.push(`   _${item.description}_`);
    });
    lines.push("");
  }

  return lines.join("\n").trim();
}

export function formatCategoryMenu(category: MenuCategory): string {
  const lines = [`📂 *${category.name}*\n`];

  category.items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.name} — ${formatCurrency(item.price)}`);
    lines.push(`   _${item.description}_`);
  });

  lines.push("\nEscribe el *número* del plato o *0* para volver.");
  return lines.join("\n");
}

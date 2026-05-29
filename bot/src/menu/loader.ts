import menuData from "./menu.json" with { type: "json" };

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface Menu {
  categories: MenuCategory[];
}

const menu = menuData as Menu;

export function getMenu(): Menu {
  return menu;
}

export function getCategoryByIndex(index: number): MenuCategory | undefined {
  return menu.categories[index - 1];
}

export function getItemByIndex(
  category: MenuCategory,
  index: number,
): MenuItem | undefined {
  return category.items[index - 1];
}

export function findItemById(itemId: string): {
  item: MenuItem;
  category: MenuCategory;
} | null {
  for (const category of menu.categories) {
    const item = category.items.find((entry) => entry.id === itemId);
    if (item) {
      return { item, category };
    }
  }
  return null;
}

export function formatFullMenu(): string {
  const lines = ["📋 *Carta completa*\n"];

  for (const category of menu.categories) {
    lines.push(`*${category.name}*`);
    category.items.forEach((item, index) => {
      lines.push(
        `${index + 1}. ${item.name} — ${formatItemPrice(item.price)}`,
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
    lines.push(`${index + 1}. ${item.name} — ${formatItemPrice(item.price)}`);
    lines.push(`   _${item.description}_`);
  });

  lines.push("\nEscribe el *número* del plato o *0* para volver.");
  return lines.join("\n");
}

function formatItemPrice(price: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(price);
}

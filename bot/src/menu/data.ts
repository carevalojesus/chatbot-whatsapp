import menuData from "./menu.json" with { type: "json" };
import type { Menu, MenuCategory, MenuItem } from "./types.js";
import { isFirebaseEnabled } from "../firebase/admin.js";
import { loadMenuFromFirestore } from "./firestore.js";

let cachedMenu: Menu = menuData as Menu;

export function getMenu(): Menu {
  return cachedMenu;
}

export function setMenu(menu: Menu): void {
  cachedMenu = menu;
}

export async function loadMenu(): Promise<Menu> {
  if (isFirebaseEnabled()) {
    cachedMenu = await loadMenuFromFirestore();
    return cachedMenu;
  }

  cachedMenu = menuData as Menu;
  return cachedMenu;
}

export function getCategoryByIndex(index: number): MenuCategory | undefined {
  return cachedMenu.categories[index - 1];
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
  for (const category of cachedMenu.categories) {
    const item = category.items.find((entry) => entry.id === itemId);
    if (item) {
      return { item, category };
    }
  }
  return null;
}

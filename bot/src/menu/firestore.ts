import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "../firebase/admin.js";
import { menuDoc } from "../firebase/paths.js";
import type { Menu } from "./types.js";
import menuData from "./menu.json" with { type: "json" };

export async function loadMenuFromFirestore(): Promise<Menu> {
  const snap = await menuDoc(getDb()).get();
  if (!snap.exists) {
    return menuData as Menu;
  }

  const data = snap.data() as Menu;
  return data.categories?.length ? data : (menuData as Menu);
}

export async function saveMenuToFirestore(menu: Menu): Promise<void> {
  await menuDoc(getDb()).set({
    ...menu,
    updatedAt: Timestamp.now(),
  });
}

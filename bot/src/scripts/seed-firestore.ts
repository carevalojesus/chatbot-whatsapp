import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import menuData from "../menu/menu.json" with { type: "json" };
import { initFirebase } from "../firebase/admin.js";
import { saveMenuToFirestore } from "../menu/firestore.js";
import type { Menu } from "../menu/types.js";
import {
  normalizePhone,
  saveRestaurantProfile,
  toWhatsAppId,
  type RestaurantProfile,
} from "../restaurant/profile.js";
import { config } from "../config.js";
import { countersDoc } from "../firebase/paths.js";
import { getDb } from "../firebase/admin.js";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

dotenv.config({ path: path.join(rootDir, ".env") });

async function seed(): Promise<void> {
  if (!config.firebase.enabled) {
    console.error(
      "ERROR: Define FIREBASE_SERVICE_ACCOUNT en .env con la ruta al JSON de service account.",
    );
    process.exit(1);
  }

  await initFirebase();

  const adminPhone = normalizePhone(
    process.env.RESTAURANT_ADMIN_PHONE ?? "933240664",
  );

  const profile: RestaurantProfile = {
    id: config.restaurant.id,
    name: process.env.RESTAURANT_NAME ?? "La Curva del Paraíso",
    deliveryFee: Number(process.env.DELIVERY_FEE ?? 8),
    adminPhone,
    adminWhatsAppId: toWhatsAppId(adminPhone),
    adminChatIds: config.restaurant.adminChatIds,
    schedule: process.env.RESTAURANT_SCHEDULE ?? "Mar–Dom 11:00 – 17:00 (cerrado lunes)",
    deliveryZone:
      process.env.RESTAURANT_DELIVERY_ZONE ?? "Surco, Miraflores y alrededores",
    currency: process.env.RESTAURANT_CURRENCY ?? "PEN",
    active: true,
  };

  await saveRestaurantProfile(profile);
  await saveMenuToFirestore(menuData as Menu);
  await countersDoc(getDb()).set({ orderCounter: 1000 }, { merge: true });

  console.log("Firebase inicializado correctamente:");
  console.log(`  Restaurante: ${profile.name} (${profile.id})`);
  console.log(`  Admin WhatsApp: ${profile.adminWhatsAppId}`);
  console.log(`  Carta: ${(menuData as Menu).categories.length} categorías`);
  console.log(`  Contador pedidos: 1000`);
}

seed().catch((error) => {
  console.error("Error en seed:", error);
  process.exit(1);
});

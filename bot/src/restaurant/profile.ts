import { Timestamp } from "firebase-admin/firestore";
import { config } from "../config.js";
import { getDb, isFirebaseEnabled } from "../firebase/admin.js";
import { restaurantDoc } from "../firebase/paths.js";

export interface RestaurantProfile {
  id: string;
  name: string;
  deliveryFee: number;
  adminPhone: string;
  adminWhatsAppId: string;
  adminChatIds: string[];
  schedule: string;
  deliveryZone: string;
  currency: string;
  active: boolean;
}

let profile: RestaurantProfile = buildDefaultProfile();

function buildDefaultProfile(): RestaurantProfile {
  return {
    id: config.restaurant.id,
    name: config.restaurant.name,
    deliveryFee: config.restaurant.deliveryFee,
    adminPhone: config.restaurant.adminPhone,
    adminWhatsAppId: config.restaurant.adminWhatsAppId,
    adminChatIds: [...config.restaurant.adminChatIds],
    schedule: config.restaurant.schedule,
    deliveryZone: config.restaurant.deliveryZone,
    currency: config.restaurant.currency,
    active: true,
  };
}

export function getRestaurantProfile(): RestaurantProfile {
  return profile;
}

export function getRestaurantName(): string {
  return profile.name;
}

export function getDeliveryFee(): number {
  return profile.deliveryFee;
}

export function getAdminWhatsAppId(): string {
  return profile.adminWhatsAppId;
}

export function isAdminChatId(chatId: string): boolean {
  const { adminWhatsAppId, adminPhone, adminChatIds } = getRestaurantProfile();

  if (adminChatIds.includes(chatId)) {
    return true;
  }

  if (chatId === adminWhatsAppId) {
    return true;
  }

  const chatPhone = chatId.split("@")[0]?.replace(/\D/g, "") ?? "";
  return chatPhone.length >= 9 && chatPhone === adminPhone;
}

export function rememberAdminChatId(chatId: string): void {
  if (!profile.adminChatIds.includes(chatId)) {
    profile.adminChatIds.push(chatId);
  }
}

export async function loadRestaurantProfile(): Promise<RestaurantProfile> {
  if (!isFirebaseEnabled()) {
    profile = buildDefaultProfile();
    return profile;
  }

  const db = getDb();
  const snap = await restaurantDoc(db).get();

  if (!snap.exists) {
    profile = buildDefaultProfile();
    return profile;
  }

  const data = snap.data() as Partial<RestaurantProfile>;
  profile = {
    id: data.id ?? config.restaurant.id,
    name: data.name ?? config.restaurant.name,
    deliveryFee: data.deliveryFee ?? config.restaurant.deliveryFee,
    adminPhone: data.adminPhone ?? config.restaurant.adminPhone,
    adminWhatsAppId: data.adminWhatsAppId ?? config.restaurant.adminWhatsAppId,
    adminChatIds: data.adminChatIds?.length
      ? data.adminChatIds
      : [...config.restaurant.adminChatIds],
    schedule: data.schedule ?? config.restaurant.schedule,
    deliveryZone: data.deliveryZone ?? config.restaurant.deliveryZone,
    currency: data.currency ?? config.restaurant.currency,
    active: data.active ?? true,
  };

  return profile;
}

export async function saveRestaurantProfile(
  input: RestaurantProfile,
): Promise<void> {
  const db = getDb();
  await restaurantDoc(db).set(
    {
      ...input,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );
  profile = input;
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("51") && digits.length === 11) {
    return digits;
  }
  if (digits.length === 9) {
    return `51${digits}`;
  }
  return digits;
}

export function toWhatsAppId(phone: string): string {
  return `${normalizePhone(phone)}@c.us`;
}

import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

dotenv.config({ path: path.join(rootDir, ".env") });

function resolveServiceAccountPath(): string {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(rootDir, fromEnv);
  }
  return path.join(rootDir, "firebase-service-account.json");
}

const serviceAccountPath = resolveServiceAccountPath();
const serviceAccountExists = (() => {
  try {
    readFileSync(serviceAccountPath);
    return true;
  } catch {
    return false;
  }
})();

function required(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value.trim();
}

function parseAdminChatIds(adminPhone: string): string[] {
  const fromEnv = process.env.RESTAURANT_ADMIN_CHAT_IDS?.trim();
  if (fromEnv) {
    return fromEnv.split(",").map((id) => id.trim()).filter(Boolean);
  }
  return [`${adminPhone}@c.us`];
}

function parseClosedDays(value: string | undefined): number[] {
  if (!value?.trim()) {
    return [1];
  }
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

function parseDeliveryKeywords(
  keywordsEnv: string | undefined,
  zoneLabel: string,
): string[] {
  const source = keywordsEnv?.trim() || zoneLabel;
  return source
    .split(/[,;|/]/)
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, ""),
    )
    .filter((part) => part.length >= 3 && !["y", "alrededores"].includes(part));
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }
  return ["1", "true", "yes", "si", "sí"].includes(value.trim().toLowerCase());
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  restaurantName: process.env.RESTAURANT_NAME ?? "La Curva del Paraíso",
  deliveryFee: Number(process.env.DELIVERY_FEE ?? 8),
  restaurant: {
    id: process.env.RESTAURANT_ID ?? "la-curva-del-paraiso",
    name: process.env.RESTAURANT_NAME ?? "La Curva del Paraíso",
    deliveryFee: Number(process.env.DELIVERY_FEE ?? 8),
    adminPhone: normalizeAdminPhone(process.env.RESTAURANT_ADMIN_PHONE ?? "933240664"),
    adminWhatsAppId: "",
    adminChatIds: [] as string[],
    schedule: process.env.RESTAURANT_SCHEDULE ?? "Lun–Dom 11:00 – 22:00",
    deliveryZone:
      process.env.RESTAURANT_DELIVERY_ZONE ?? "Zona centro (consultar cobertura)",
    currency: process.env.RESTAURANT_CURRENCY ?? "PEN",
    enforceHours: parseBool(process.env.RESTAURANT_ENFORCE_HOURS, true),
    closedDays: parseClosedDays(process.env.RESTAURANT_CLOSED_DAYS),
    openTime: process.env.RESTAURANT_OPEN_TIME ?? "11:00",
    closeTime: process.env.RESTAURANT_CLOSE_TIME ?? "17:00",
    timezone: process.env.RESTAURANT_TIMEZONE ?? "America/Lima",
    validateDeliveryZone: parseBool(
      process.env.RESTAURANT_VALIDATE_DELIVERY_ZONE,
      true,
    ),
    deliveryKeywords: parseDeliveryKeywords(
      process.env.RESTAURANT_DELIVERY_KEYWORDS,
      process.env.RESTAURANT_DELIVERY_ZONE ??
        "Surco, Miraflores y alrededores",
    ),
    yapePhone: process.env.RESTAURANT_YAPE_PHONE?.trim() || "",
    plinPhone: process.env.RESTAURANT_PLIN_PHONE?.trim() || "",
    bankAccount: process.env.RESTAURANT_BANK_ACCOUNT?.trim() || "",
  },
  firebase: {
    enabled:
      Boolean(process.env.FIREBASE_SERVICE_ACCOUNT?.trim()) ||
      serviceAccountExists,
    serviceAccountPath,
    projectId:
      process.env.FIREBASE_PROJECT_ID?.trim() || "chatbot-restaurante-40e94",
  },
  openwa: {
    url: (process.env.OPENWA_URL ?? "http://localhost:2785").replace(/\/$/, ""),
    apiKey: process.env.OPENWA_API_KEY ?? "dev-admin-key",
    sessionName: process.env.OPENWA_SESSION_NAME ?? "restaurante",
    sessionId: process.env.OPENWA_SESSION_ID ?? "",
  },
  webhookSecret: process.env.WEBHOOK_SECRET ?? "cambia-este-secreto",
  session: {
    /** Minutos sin mensajes antes de cancelar un pedido en curso */
    inactivityMinutes: Number(process.env.SESSION_INACTIVITY_MINUTES ?? 30),
    /** Minutos sin mensajes para enviar aviso "¿seguimos?" */
    warningMinutes: Number(process.env.SESSION_WARNING_MINUTES ?? 25),
  },
  ops: {
    watchdogEnabled: parseBool(process.env.OPS_WATCHDOG_ENABLED, true),
    watchdogIntervalSeconds: Number(process.env.OPS_WATCHDOG_INTERVAL_SECONDS ?? 60),
    recoveryCooldownSeconds: Number(process.env.OPS_RECOVERY_COOLDOWN_SECONDS ?? 300),
  },
};

function normalizeAdminPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("51") && digits.length === 11) {
    return digits;
  }
  if (digits.length === 9) {
    return `51${digits}`;
  }
  return digits;
}

config.restaurant.adminWhatsAppId = `${config.restaurant.adminPhone}@c.us`;
config.restaurant.adminChatIds = parseAdminChatIds(config.restaurant.adminPhone);
if (!config.restaurant.adminChatIds.includes(config.restaurant.adminWhatsAppId)) {
  config.restaurant.adminChatIds.push(config.restaurant.adminWhatsAppId);
}

if (!config.restaurant.yapePhone) {
  config.restaurant.yapePhone = config.restaurant.adminPhone.slice(-9);
}
if (!config.restaurant.plinPhone) {
  config.restaurant.plinPhone = config.restaurant.yapePhone;
}

export function assertOpenWaConfig(): void {
  required("OPENWA_API_KEY", config.openwa.apiKey);
}

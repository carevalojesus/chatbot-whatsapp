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
    schedule: process.env.RESTAURANT_SCHEDULE ?? "Lun–Dom 11:00 – 22:00",
    deliveryZone:
      process.env.RESTAURANT_DELIVERY_ZONE ?? "Zona centro (consultar cobertura)",
    currency: process.env.RESTAURANT_CURRENCY ?? "PEN",
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

export function assertOpenWaConfig(): void {
  required("OPENWA_API_KEY", config.openwa.apiKey);
}

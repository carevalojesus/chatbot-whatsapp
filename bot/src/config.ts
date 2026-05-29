import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

dotenv.config({ path: path.join(rootDir, ".env") });

function required(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value.trim();
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  restaurantName: process.env.RESTAURANT_NAME ?? "La Buena Mesa",
  deliveryFee: Number(process.env.DELIVERY_FEE ?? 5000),
  openwa: {
    url: (process.env.OPENWA_URL ?? "http://localhost:2785").replace(/\/$/, ""),
    apiKey: process.env.OPENWA_API_KEY ?? "dev-admin-key",
    sessionName: process.env.OPENWA_SESSION_NAME ?? "restaurante",
    sessionId: process.env.OPENWA_SESSION_ID ?? "",
  },
  webhookSecret: process.env.WEBHOOK_SECRET ?? "cambia-este-secreto",
};

export function assertOpenWaConfig(): void {
  required("OPENWA_API_KEY", config.openwa.apiKey);
}

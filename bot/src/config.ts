import "dotenv/config";

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
    apiKey: process.env.OPENWA_API_KEY ?? "",
    sessionName: process.env.OPENWA_SESSION_NAME ?? "restaurante",
  },
  webhookSecret: process.env.WEBHOOK_SECRET ?? "cambia-este-secreto",
};

export function assertOpenWaConfig(): void {
  required("OPENWA_API_KEY", config.openwa.apiKey);
}

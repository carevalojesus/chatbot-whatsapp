import { randomBytes } from "node:crypto";

export function generateValidationToken(): string {
  return randomBytes(16).toString("hex");
}

export function buildQrPayload(orderId: string, token: string): string {
  return `LCP:${orderId}:${token}`;
}

export function parseQrPayload(payload: string): {
  orderId: string;
  token: string;
} | null {
  const match = payload.trim().match(/^LCP:(\d+):([a-f0-9]+)$/i);
  if (!match) return null;
  return { orderId: match[1], token: match[2] };
}

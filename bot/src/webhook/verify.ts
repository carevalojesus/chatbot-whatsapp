import crypto from "node:crypto";
import { config } from "../config.js";

export function verifyWebhookSignature(
  payload: unknown,
  signature: string | undefined,
): boolean {
  if (!signature) return false;

  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", config.webhookSecret)
      .update(JSON.stringify(payload))
      .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}

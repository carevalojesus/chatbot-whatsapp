import crypto from "node:crypto";
import { config } from "../config.js";

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | undefined,
): boolean {
  if (!signature) {
    console.warn("Webhook sin firma X-OpenWA-Signature");
    return false;
  }

  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", config.webhookSecret)
      .update(rawBody)
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

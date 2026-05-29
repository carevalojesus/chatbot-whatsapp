const seen = new Map<string, number>();
const recentText = new Map<string, number>();
const TTL_MS = 10 * 60 * 1000;
const BURST_MS = 2000;

export function isDuplicateEvent(key: string): boolean {
  const now = Date.now();

  for (const [id, ts] of seen) {
    if (now - ts > TTL_MS) {
      seen.delete(id);
    }
  }

  if (seen.has(key)) {
    return true;
  }

  seen.set(key, now);
  return false;
}

/** Mismo texto en ventana corta (@c.us + @lid del mismo mensaje). */
export function isDuplicateBurst(from: string, text: string): boolean {
  const key = `${from}:${text.toLowerCase().trim()}`;
  const now = Date.now();

  for (const [id, ts] of recentText) {
    if (now - ts > BURST_MS) {
      recentText.delete(id);
    }
  }

  const last = recentText.get(key);
  if (last !== undefined && now - last < BURST_MS) {
    return true;
  }

  recentText.set(key, now);
  return false;
}

export function eventKey(
  idempotencyHeader: string | undefined,
  deliveryId: string | undefined,
  messageId: string | undefined,
  from: string,
  text: string,
): string {
  if (deliveryId) {
    return deliveryId;
  }

  if (idempotencyHeader && !isWeakIdempotencyKey(idempotencyHeader)) {
    return idempotencyHeader;
  }

  if (messageId && messageId !== "unknown") {
    return `msg_${messageId}`;
  }

  return `fallback_${from}_${text}_${Date.now()}`;
}

const crossChannel = new Map<string, number>();
const CROSS_CHANNEL_MS = 3000;

/** @c.us y @lid del mismo mensaje llegan casi al mismo tiempo. */
export function isDuplicateCrossChannel(text: string): boolean {
  const key = text.toLowerCase().trim();
  const now = Date.now();

  for (const [id, ts] of crossChannel) {
    if (now - ts > CROSS_CHANNEL_MS) {
      crossChannel.delete(id);
    }
  }

  const last = crossChannel.get(key);
  if (last !== undefined && now - last < CROSS_CHANNEL_MS) {
    return true;
  }

  crossChannel.set(key, now);
  return false;
}

function isWeakIdempotencyKey(key: string): boolean {
  return (
    key === "msg_unknown" ||
    key.endsWith("_unknown") ||
    key === "unknown"
  );
}

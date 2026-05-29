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
export function isDuplicateBurst(text: string): boolean {
  const key = text.toLowerCase().trim();
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
  messageId: string | undefined,
  from: string,
  text: string,
): string {
  if (idempotencyHeader) {
    return idempotencyHeader;
  }
  if (messageId) {
    return `msg_${messageId}`;
  }
  return `fallback_${from}_${text}`;
}

import { config } from "../config.js";

interface OpenWaSession {
  id: string;
  name: string;
  status: string;
}

let cachedSessionId: string | null = config.openwa.sessionId || null;

async function headers(): Promise<Record<string, string>> {
  return {
    "Content-Type": "application/json",
    "X-API-Key": config.openwa.apiKey,
  };
}

export async function getSessionId(): Promise<string> {
  if (cachedSessionId) return cachedSessionId;

  const response = await fetch(`${config.openwa.url}/api/sessions`, {
    headers: await headers(),
  });

  if (!response.ok) {
    throw new Error(`No se pudo listar sesiones OpenWA (${response.status})`);
  }

  const sessions = (await response.json()) as OpenWaSession[];
  const session = sessions.find(
    (entry) =>
      entry.name === config.openwa.sessionName ||
      entry.id === config.openwa.sessionName,
  );

  if (!session) {
    throw new Error(
      `Sesión '${config.openwa.sessionName}' no encontrada. Ejecuta ./scripts/register-webhook.sh`,
    );
  }

  cachedSessionId = session.id;
  return cachedSessionId;
}

export async function sendTextMessage(chatId: string, text: string): Promise<void> {
  const sessionId = await getSessionId();
  const url = `${config.openwa.url}/api/sessions/${sessionId}/messages/send-text`;

  const response = await fetch(url, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ chatId, text }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      error?: string;
    } | null;
    const message = body?.message ?? body?.error ?? response.statusText;
    throw new Error(`OpenWA send-text falló (${response.status}): ${message}`);
  }
}

export async function ensureSessionExists(): Promise<string> {
  try {
    return await getSessionId();
  } catch {
    const createUrl = `${config.openwa.url}/api/sessions`;
    const createResponse = await fetch(createUrl, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify({ name: config.openwa.sessionName }),
    });

    if (!createResponse.ok) {
      throw new Error(`No se pudo crear la sesión (${createResponse.status})`);
    }

    const session = (await createResponse.json()) as OpenWaSession;
    cachedSessionId = session.id;
    return session.id;
  }
}

export async function registerWebhook(
  webhookUrl: string,
  secret: string,
): Promise<void> {
  const sessionId = await getSessionId();
  const url = `${config.openwa.url}/api/sessions/${sessionId}/webhooks`;

  const response = await fetch(url, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({
      url: webhookUrl,
      events: ["message.received"],
      secret,
    }),
  });

  if (!response.ok && response.status !== 403) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(
      `No se pudo registrar webhook (${response.status}): ${body?.message ?? response.statusText}`,
    );
  }
}

export async function startSession(): Promise<void> {
  const sessionId = await getSessionId();
  const url = `${config.openwa.url}/api/sessions/${sessionId}/start`;

  await fetch(url, {
    method: "POST",
    headers: await headers(),
  });
}

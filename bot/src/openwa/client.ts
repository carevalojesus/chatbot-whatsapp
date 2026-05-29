import { config } from "../config.js";

interface OpenWaResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export async function sendTextMessage(chatId: string, text: string): Promise<void> {
  const url = `${config.openwa.url}/api/sessions/${config.openwa.sessionName}/messages/send-text`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.openwa.apiKey,
    },
    body: JSON.stringify({ chatId, text }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as OpenWaResponse | null;
    const message = body?.error?.message ?? response.statusText;
    throw new Error(`OpenWA send-text falló (${response.status}): ${message}`);
  }
}

export async function ensureSessionExists(): Promise<void> {
  const listUrl = `${config.openwa.url}/api/sessions`;
  const listResponse = await fetch(listUrl, {
    headers: { "X-API-Key": config.openwa.apiKey },
  });

  if (!listResponse.ok) {
    throw new Error(`No se pudo listar sesiones OpenWA (${listResponse.status})`);
  }

  const listBody = (await listResponse.json()) as OpenWaResponse<
    Array<{ id: string; name: string }>
  >;

  const sessions = listBody.data ?? [];
  const exists = sessions.some(
    (session) =>
      session.name === config.openwa.sessionName ||
      session.id === config.openwa.sessionName,
  );

  if (exists) return;

  const createUrl = `${config.openwa.url}/api/sessions`;
  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.openwa.apiKey,
    },
    body: JSON.stringify({ name: config.openwa.sessionName }),
  });

  if (!createResponse.ok) {
    throw new Error(`No se pudo crear la sesión (${createResponse.status})`);
  }
}

export async function registerWebhook(
  webhookUrl: string,
  secret: string,
): Promise<void> {
  const url = `${config.openwa.url}/api/sessions/${config.openwa.sessionName}/webhooks`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.openwa.apiKey,
    },
    body: JSON.stringify({
      url: webhookUrl,
      events: ["message.received"],
      secret,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as OpenWaResponse | null;
    const message = body?.error?.message ?? response.statusText;

    if (response.status === 403 && message.toLowerCase().includes("limit")) {
      return;
    }

    throw new Error(`No se pudo registrar webhook (${response.status}): ${message}`);
  }
}

export async function startSession(): Promise<void> {
  const url = `${config.openwa.url}/api/sessions/${config.openwa.sessionName}/start`;

  await fetch(url, {
    method: "POST",
    headers: { "X-API-Key": config.openwa.apiKey },
  });
}

import { config } from "../config.js";
import { getSessionId, startSession } from "../openwa/client.js";

export interface OpenWaHealth {
  ok: boolean;
  api: boolean;
  sessionReady: boolean;
  status?: string;
  reason?: string;
}

export async function checkOpenWaHealth(): Promise<OpenWaHealth> {
  try {
    const response = await fetch(`${config.openwa.url}/api/health`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return {
        ok: false,
        api: false,
        sessionReady: false,
        reason: `API HTTP ${response.status}`,
      };
    }
  } catch (error) {
    return {
      ok: false,
      api: false,
      sessionReady: false,
      reason: error instanceof Error ? error.message : "API no responde",
    };
  }

  try {
    const sessionId = await getSessionId();
    const response = await fetch(
      `${config.openwa.url}/api/sessions/${sessionId}`,
      {
        headers: {
          "X-API-Key": config.openwa.apiKey,
        },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        api: true,
        sessionReady: false,
        reason: `Sesión HTTP ${response.status}`,
      };
    }

    const session = (await response.json()) as { status?: string };
    const status = session.status ?? "unknown";
    const sessionReady = ["ready", "connected", "open"].includes(
      status.toLowerCase(),
    );

    return {
      ok: sessionReady,
      api: true,
      sessionReady,
      status,
      reason: sessionReady ? undefined : `Sesión en estado ${status}`,
    };
  } catch (error) {
    return {
      ok: false,
      api: true,
      sessionReady: false,
      reason: error instanceof Error ? error.message : "Sesión no disponible",
    };
  }
}

export async function tryRecoverOpenWaSession(): Promise<boolean> {
  try {
    await startSession();
    const health = await checkOpenWaHealth();
    return health.ok;
  } catch {
    return false;
  }
}

import { config } from "../config.js";
import { sendTextMessage } from "../openwa/client.js";
import {
  checkSessionIdle,
  expireSessionIfIdle,
  formatSessionExpiredMessage,
  formatSessionWarningMessage,
  getIdleMs,
  markInactivityWarningSent,
  sessionHasProgress,
} from "./expiry.js";
import { saveSession } from "./index.js";
import type { UserSession } from "./types.js";

const SWEEP_INTERVAL_MS = 60_000;

export function startIdleSessionWatcher(): void {
  const run = () => {
    runIdleSessionSweep().catch((error) => {
      console.error("Error en revisión de sesiones inactivas:", error);
    });
  };

  run();
  setInterval(run, SWEEP_INTERVAL_MS);

  console.log(
    `Sesiones inactivas: aviso a los ${config.session.warningMinutes} min, expira a los ${config.session.inactivityMinutes} min`,
  );
}

export async function runIdleSessionSweep(): Promise<void> {
  const sessions = await listSessionsWithProgress();

  for (const session of sessions) {
    await processIdleSession(session);
  }
}

async function processIdleSession(session: UserSession): Promise<void> {
  const status = checkSessionIdle(session);

  if (status === "expired") {
    const hadProgress = sessionHasProgress(session);
    if (!hadProgress) {
      return;
    }

    expireSessionIfIdle(session);
    await saveSession(session);
    await sendTextMessage(
      session.chatId,
      formatSessionExpiredMessage(),
    );
    return;
  }

  if (status === "warn") {
    markInactivityWarningSent(session);
    await saveSession(session);
    await sendTextMessage(session.chatId, formatSessionWarningMessage());
    console.log(
      `Aviso inactividad → ${session.chatId} (${Math.round(getIdleMs(session) / 60000)} min)`,
    );
  }
}

async function listSessionsWithProgress(): Promise<UserSession[]> {
  const { listSessionsWithProgress: list } = await import("./index.js");
  return list();
}

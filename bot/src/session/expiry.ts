import { config } from "../config.js";
import { clearSessionFields, type UserSession } from "./types.js";

export type IdleCheckResult = "active" | "warn" | "expired";

function expiryMs(): number {
  return config.session.inactivityMinutes * 60 * 1000;
}

function warningMs(): number {
  return config.session.warningMinutes * 60 * 1000;
}

export function sessionHasProgress(session: UserSession): boolean {
  return session.state !== "main_menu" || session.cart.length > 0;
}

export function getIdleMs(session: UserSession): number {
  if (!session.lastActivityAt) {
    return 0;
  }
  return Date.now() - session.lastActivityAt;
}

export function checkSessionIdle(session: UserSession): IdleCheckResult {
  if (!session.lastActivityAt || !sessionHasProgress(session)) {
    return "active";
  }

  const idle = getIdleMs(session);
  if (idle >= expiryMs()) {
    return "expired";
  }

  if (!session.awaitingInactivityConfirm && idle >= warningMs()) {
    return "warn";
  }

  return "active";
}

export function touchSession(session: UserSession): void {
  session.lastActivityAt = Date.now();
}

export function markInactivityWarningSent(session: UserSession): void {
  session.awaitingInactivityConfirm = true;
}

export function resumeAfterInactivity(session: UserSession): void {
  session.awaitingInactivityConfirm = false;
  touchSession(session);
}

/** Limpia sesión inactiva. Devuelve true si había un flujo en curso. */
export function expireSessionIfIdle(session: UserSession): boolean {
  if (checkSessionIdle(session) !== "expired") {
    return false;
  }

  const hadProgress = sessionHasProgress(session);
  if (hadProgress) {
    clearSessionFields(session);
  }

  session.awaitingInactivityConfirm = false;
  touchSession(session);
  return hadProgress;
}

export function formatSessionWarningMessage(): string {
  const warning = config.session.warningMinutes;
  const total = config.session.inactivityMinutes;
  const remaining = Math.max(1, total - warning);

  return `⏳ Llevas *${warning} minutos* sin escribir.

¿Seguimos con tu pedido?

1️⃣ Sí, continuar
0️⃣ No, cancelar

_Si no respondes en *${remaining} min* más, el pedido se cancelará solo._`;
}

export function formatSessionExpiredMessage(): string {
  const minutes = config.session.inactivityMinutes;
  return `⏱️ Pasaron más de *${minutes} minutos* sin actividad, así que tu pedido en curso se canceló.

Escribe *2* para empezar de nuevo.`;
}

export function formatSessionExpiredWithMenu(mainMenu: string): string {
  return `${formatSessionExpiredMessage()}\n\n${mainMenu}`;
}

export function isInactivityContinueCommand(text: string): boolean {
  return ["1", "si", "sí", "continuar", "seguir", "ok"].includes(text);
}

export function isInactivityCancelCommand(text: string): boolean {
  return ["0", "no", "cancelar"].includes(text);
}

import {
  clearSessionFields,
  createEmptySession,
  type UserSession,
} from "./types.js";

const sessions = new Map<string, UserSession>();

export async function getSession(chatId: string): Promise<UserSession> {
  const existing = sessions.get(chatId);
  if (existing) return existing;

  const session = createEmptySession(chatId);
  sessions.set(chatId, session);
  return session;
}

export async function getSessionIfExists(
  chatId: string,
): Promise<UserSession | null> {
  return sessions.get(chatId) ?? null;
}

export async function saveSession(session: UserSession): Promise<void> {
  sessions.set(session.chatId, session);
}

export async function resetSession(chatId: string): Promise<UserSession> {
  const session = await getSession(chatId);
  clearSessionFields(session);
  sessions.set(chatId, session);
  return session;
}

export async function listSessionsWithProgress(): Promise<UserSession[]> {
  return Array.from(sessions.values()).filter(
    (session) => session.state !== "main_menu" || session.cart.length > 0,
  );
}

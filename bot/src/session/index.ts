import { isFirebaseEnabled } from "../firebase/admin.js";
import * as firestoreStore from "./firestore.js";
import * as memoryStore from "./memory.js";
import {
  mergeOrderingSession,
  resolveSessionChatId,
} from "./resolveChatId.js";
import type { BotState, CartItem, UserSession } from "./types.js";

const store = isFirebaseEnabled() ? firestoreStore : memoryStore;

export type { BotState, CartItem, UserSession } from "./types.js";
export { isOrderingState, clearSessionFields, clearOrderingFields } from "./types.js";
export {
  expireSessionIfIdle,
  formatSessionExpiredMessage,
  formatSessionWarningMessage,
  touchSession,
  checkSessionIdle,
  markInactivityWarningSent,
  resumeAfterInactivity,
  isInactivityContinueCommand,
  isInactivityCancelCommand,
  sessionHasProgress,
} from "./expiry.js";

export const getSession = (chatId: string): Promise<UserSession> =>
  store.getSession(chatId);

export async function getSessionForChat(
  incomingChatId: string,
): Promise<UserSession> {
  const canonicalChatId = await resolveSessionChatId(incomingChatId);
  const session = await store.getSession(canonicalChatId);
  session.chatId = canonicalChatId;

  if (incomingChatId !== canonicalChatId) {
    const alt = await store.getSessionIfExists(incomingChatId);
    if (alt) {
      mergeOrderingSession(session, alt);
    }
  }

  return session;
}

export const saveSession = (session: UserSession): Promise<void> =>
  store.saveSession(session);

export const resetSession = (chatId: string): Promise<UserSession> =>
  store.resetSession(chatId);

export const listSessionsWithProgress = (): Promise<UserSession[]> =>
  store.listSessionsWithProgress();

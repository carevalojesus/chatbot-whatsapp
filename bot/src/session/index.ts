import { isFirebaseEnabled } from "../firebase/admin.js";
import * as firestoreStore from "./firestore.js";
import * as memoryStore from "./memory.js";
import type { BotState, CartItem, UserSession } from "./types.js";

const store = isFirebaseEnabled() ? firestoreStore : memoryStore;

export type { BotState, CartItem, UserSession } from "./types.js";
export { isOrderingState, clearSessionFields } from "./types.js";

export const getSession = (chatId: string): Promise<UserSession> =>
  store.getSession(chatId);

export const saveSession = (session: UserSession): Promise<void> =>
  store.saveSession(session);

export const resetSession = (chatId: string): Promise<UserSession> =>
  store.resetSession(chatId);

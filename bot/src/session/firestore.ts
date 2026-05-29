import type { DocumentData } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "../firebase/admin.js";
import { sessionDocId, sessionsCollection } from "../firebase/paths.js";
import {
  clearSessionFields,
  createEmptySession,
  type UserSession,
} from "./types.js";

function mapSession(data: DocumentData): UserSession {
  return {
    chatId: data.chatId,
    customerId: data.customerId,
    customerName: data.customerName,
    state: data.state,
    cart: data.cart ?? [],
    selectedCategoryIndex: data.selectedCategoryIndex,
    pendingItemIndex: data.pendingItemIndex,
    deliveryType: data.deliveryType,
    address: data.address,
    addressAlias: data.addressAlias,
    selectedOrderId: data.selectedOrderId,
    pendingAddressAlias: data.pendingAddressAlias,
    pendingAddressLine: data.pendingAddressLine,
  };
}

export async function getSession(chatId: string): Promise<UserSession> {
  const ref = sessionsCollection(getDb()).doc(sessionDocId(chatId));
  const snap = await ref.get();

  if (!snap.exists) {
    const session = createEmptySession(chatId);
    await ref.set({
      ...session,
      updatedAt: Timestamp.now(),
    });
    return session;
  }

  return mapSession(snap.data()!);
}

export async function saveSession(session: UserSession): Promise<void> {
  await sessionsCollection(getDb())
    .doc(sessionDocId(session.chatId))
    .set(
      {
        ...session,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
}

export async function resetSession(chatId: string): Promise<UserSession> {
  const session = await getSession(chatId);
  clearSessionFields(session);
  await saveSession(session);
  return session;
}

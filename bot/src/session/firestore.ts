import type { DocumentData } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "../firebase/admin.js";
import { sessionDocId, sessionsCollection } from "../firebase/paths.js";
import { sessionHasProgress } from "./expiry.js";
import {
  clearSessionFields,
  createEmptySession,
  type UserSession,
} from "./types.js";

function readLastActivityAt(data: DocumentData): number | undefined {
  if (typeof data.lastActivityAt === "number") {
    return data.lastActivityAt;
  }
  const updatedAt = data.updatedAt as Timestamp | undefined;
  return updatedAt?.toMillis?.();
}

function mapSession(data: DocumentData): UserSession {
  let state = data.state;
  if (data.promptContext === "after_add" && state === "browse_categories") {
    state = "after_add_to_cart";
  }

  return {
    chatId: data.chatId,
    customerId: data.customerId,
    customerName: data.customerName,
    state,
    cart: data.cart ?? [],
    selectedCategoryIndex: data.selectedCategoryIndex,
    pendingItemIndex: data.pendingItemIndex,
    deliveryType: data.deliveryType,
    address: data.address,
    addressAlias: data.addressAlias,
    paymentMethod: data.paymentMethod,
    cashPaid: data.cashPaid,
    changeDue: data.changeDue,
    selectedOrderId: data.selectedOrderId,
    pendingAddressAlias: data.pendingAddressAlias,
    pendingAddressLine: data.pendingAddressLine,
    whatsappName: data.whatsappName,
    pendingAction: data.pendingAction,
    cartReturnState: data.cartReturnState,
    lastActivityAt: readLastActivityAt(data),
    awaitingInactivityConfirm: data.awaitingInactivityConfirm,
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

export async function getSessionIfExists(
  chatId: string,
): Promise<UserSession | null> {
  const ref = sessionsCollection(getDb()).doc(sessionDocId(chatId));
  const snap = await ref.get();
  if (!snap.exists) {
    return null;
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

export async function listSessionsWithProgress(): Promise<UserSession[]> {
  const snap = await sessionsCollection(getDb()).get();
  return snap.docs
    .map((doc) => mapSession(doc.data()))
    .filter((session) => sessionHasProgress(session));
}

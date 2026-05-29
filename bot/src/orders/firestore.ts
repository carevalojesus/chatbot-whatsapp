import {
  FieldValue,
  Timestamp,
  type DocumentData,
} from "firebase-admin/firestore";
import { getDb } from "../firebase/admin.js";
import { countersDoc, ordersCollection } from "../firebase/paths.js";
import type { CreateOrderInput, Order, OrderStatus } from "./types.js";

function mapOrder(id: string, data: DocumentData): Order {
  const createdAt = data.createdAt;
  return {
    id,
    chatId: data.chatId,
    customerName: data.customerName,
    items: data.items ?? [],
    deliveryType: data.deliveryType,
    address: data.address,
    subtotal: data.subtotal,
    deliveryFee: data.deliveryFee,
    total: data.total,
    status: data.status as OrderStatus,
    createdAt:
      createdAt instanceof Timestamp
        ? createdAt.toDate()
        : new Date(createdAt ?? Date.now()),
  };
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const db = getDb();

  return db.runTransaction(async (tx) => {
    const counterRef = countersDoc(db);
    const counterSnap = await tx.get(counterRef);
    const current = counterSnap.exists
      ? Number(counterSnap.data()?.orderCounter ?? 1000)
      : 1000;
    const next = current + 1;
    const orderId = String(next);

    tx.set(counterRef, { orderCounter: next }, { merge: true });
    tx.set(ordersCollection(db).doc(orderId), {
      ...input,
      orderNumber: next,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      ...input,
      id: orderId,
      createdAt: new Date(),
    };
  });
}

export async function getOrder(orderId: string): Promise<Order | undefined> {
  const snap = await ordersCollection(getDb()).doc(orderId).get();
  if (!snap.exists) return undefined;
  return mapOrder(snap.id, snap.data()!);
}

export async function getLatestOrder(
  chatId: string,
): Promise<Order | undefined> {
  const orders = await getOrdersForChat(chatId);
  return orders[0];
}

export async function getOrdersForChat(chatId: string): Promise<Order[]> {
  const snap = await ordersCollection(getDb())
    .where("chatId", "==", chatId)
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

  return snap.docs.map((doc) => mapOrder(doc.id, doc.data()));
}

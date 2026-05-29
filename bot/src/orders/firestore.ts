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
    customerId: data.customerId,
    customerName: data.customerName,
    items: data.items ?? [],
    deliveryType: data.deliveryType,
    address: data.address,
    addressAlias: data.addressAlias,
    subtotal: data.subtotal,
    deliveryFee: data.deliveryFee,
    total: data.total,
    status: data.status as OrderStatus,
    cancelledBy: data.cancelledBy,
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

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<Order | undefined> {
  const ref = ordersCollection(getDb()).doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) return undefined;

  await ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
  return mapOrder(snap.id, { ...snap.data()!, status });
}

export async function getPendingOrders(): Promise<Order[]> {
  const snap = await ordersCollection(getDb())
    .where("status", "==", "pendiente")
    .orderBy("createdAt", "desc")
    .limit(15)
    .get();

  return snap.docs.map((doc) => mapOrder(doc.id, doc.data()));
}

export async function cancelOrder(
  orderId: string,
  by: "cliente" | "admin",
): Promise<Order | undefined> {
  const ref = ordersCollection(getDb()).doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) {
    return undefined;
  }

  const current = mapOrder(snap.id, snap.data()!);
  if (current.status !== "pendiente") {
    return undefined;
  }

  await ref.update({
    status: "cancelado",
    cancelledBy: by,
    cancelledAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return mapOrder(snap.id, {
    ...snap.data()!,
    status: "cancelado",
    cancelledBy: by,
  });
}

import {
  FieldValue,
  Timestamp,
  type DocumentData,
} from "firebase-admin/firestore";
import { getDb } from "../firebase/admin.js";
import { countersDoc, ordersCollection } from "../firebase/paths.js";
import type { CreateOrderInput, Order, OrderStatus } from "./types.js";
import { generateValidationToken } from "./validation.js";
import { isValidatableStatus, type ValidateOrderResult } from "./validate.js";

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
    paymentMethod: data.paymentMethod,
    cashPaid: data.cashPaid,
    changeDue: data.changeDue,
    paymentProofReceived: data.paymentProofReceived,
    subtotal: data.subtotal,
    deliveryFee: data.deliveryFee,
    total: data.total,
    status: data.status as OrderStatus,
    cancelledBy: data.cancelledBy,
    validationToken: data.validationToken,
    validatedAt:
      data.validatedAt instanceof Timestamp
        ? data.validatedAt.toDate()
        : data.validatedAt
          ? new Date(data.validatedAt)
          : undefined,
    validatedBy: data.validatedBy,
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
    const validationToken = generateValidationToken();

    tx.set(counterRef, { orderCounter: next }, { merge: true });
    tx.set(ordersCollection(db).doc(orderId), {
      ...input,
      validationToken,
      orderNumber: next,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      ...input,
      id: orderId,
      validationToken,
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

export async function getActiveOrders(): Promise<Order[]> {
  const snap = await ordersCollection(getDb())
    .where("status", "in", ["pendiente", "confirmado"])
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  return snap.docs.map((doc) => mapOrder(doc.id, doc.data()));
}

export async function getOrdersToDeliver(): Promise<Order[]> {
  const snap = await ordersCollection(getDb())
    .where("status", "==", "confirmado")
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

export async function getOrderByValidationToken(
  token: string,
): Promise<Order | undefined> {
  const snap = await ordersCollection(getDb())
    .where("validationToken", "==", token)
    .limit(1)
    .get();

  if (snap.empty) return undefined;
  const doc = snap.docs[0];
  return mapOrder(doc.id, doc.data());
}

export async function validateOrder(
  orderId: string,
  validatedBy: string,
  token?: string,
): Promise<ValidateOrderResult> {
  const ref = ordersCollection(getDb()).doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, error: "not_found" };
  }

  const order = mapOrder(snap.id, snap.data()!);

  if (token && order.validationToken !== token) {
    return { ok: false, error: "invalid_token" };
  }

  if (order.status === "cancelado") {
    return { ok: false, error: "cancelado", order };
  }

  if (order.validatedAt || order.status === "entregado") {
    return { ok: false, error: "already_validated", order };
  }

  if (!isValidatableStatus(order.status)) {
    return { ok: false, error: "already_validated", order };
  }

  await ref.update({
    status: "entregado",
    validatedAt: FieldValue.serverTimestamp(),
    validatedBy,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    order: mapOrder(snap.id, {
      ...snap.data()!,
      status: "entregado",
      validatedAt: new Date(),
      validatedBy,
    }),
  };
}

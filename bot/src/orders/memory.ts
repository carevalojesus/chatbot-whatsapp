import type { CreateOrderInput, Order, OrderStatus } from "./types.js";
import { generateValidationToken } from "./validation.js";
import { isValidatableStatus, type ValidateOrderResult } from "./validate.js";

let orderCounter = 1000;
const ordersById = new Map<string, Order>();
const ordersByChat = new Map<string, string[]>();
const ordersByToken = new Map<string, string>();

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  orderCounter += 1;
  const id = String(orderCounter);
  const validationToken = generateValidationToken();

  const order: Order = {
    ...input,
    id,
    validationToken,
    createdAt: new Date(),
  };

  ordersById.set(id, order);
  ordersByToken.set(validationToken, id);

  const chatOrders = ordersByChat.get(input.chatId) ?? [];
  chatOrders.unshift(id);
  ordersByChat.set(input.chatId, chatOrders);

  return order;
}

export async function getOrder(orderId: string): Promise<Order | undefined> {
  return ordersById.get(orderId);
}

export async function getLatestOrder(
  chatId: string,
): Promise<Order | undefined> {
  const ids = ordersByChat.get(chatId);
  if (!ids?.length) return undefined;
  return ordersById.get(ids[0]);
}

export async function getOrdersForChat(chatId: string): Promise<Order[]> {
  const ids = ordersByChat.get(chatId) ?? [];
  return ids
    .map((id) => ordersById.get(id))
    .filter((order): order is Order => Boolean(order));
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<Order | undefined> {
  const order = ordersById.get(orderId);
  if (!order) return undefined;

  order.status = status;
  ordersById.set(orderId, order);
  return order;
}

export async function getPendingOrders(): Promise<Order[]> {
  return [...ordersById.values()]
    .filter((order) => order.status === "pendiente")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 15);
}

export async function cancelOrder(
  orderId: string,
  by: "cliente" | "admin",
): Promise<Order | undefined> {
  const order = ordersById.get(orderId);
  if (!order || order.status !== "pendiente") {
    return undefined;
  }

  order.status = "cancelado";
  order.cancelledBy = by;
  ordersById.set(orderId, order);
  return order;
}

export async function getOrderByValidationToken(
  token: string,
): Promise<Order | undefined> {
  const orderId = ordersByToken.get(token);
  if (!orderId) return undefined;
  return ordersById.get(orderId);
}

export async function validateOrder(
  orderId: string,
  validatedBy: string,
  token?: string,
): Promise<ValidateOrderResult> {
  const order = ordersById.get(orderId);
  if (!order) {
    return { ok: false, error: "not_found" };
  }

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

  order.status = "entregado";
  order.validatedAt = new Date();
  order.validatedBy = validatedBy;
  ordersById.set(orderId, order);
  return { ok: true, order };
}

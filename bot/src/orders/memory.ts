import type { CreateOrderInput, Order, OrderStatus } from "./types.js";

let orderCounter = 1000;
const ordersById = new Map<string, Order>();
const ordersByChat = new Map<string, string[]>();

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  orderCounter += 1;
  const id = String(orderCounter);

  const order: Order = {
    ...input,
    id,
    createdAt: new Date(),
  };

  ordersById.set(id, order);

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

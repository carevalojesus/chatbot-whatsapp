export type OrderStatus = "pendiente" | "confirmado" | "entregado";

export interface Order {
  id: string;
  chatId: string;
  customerName?: string;
  items: Array<{
    itemId: string;
    name: string;
    unitPrice: number;
    quantity: number;
  }>;
  deliveryType: "domicilio" | "recoger";
  address?: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  createdAt: Date;
}

let orderCounter = 1000;
const ordersById = new Map<string, Order>();
const ordersByChat = new Map<string, string[]>();

export function createOrder(input: Omit<Order, "id" | "createdAt">): Order {
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

export function getOrder(orderId: string): Order | undefined {
  return ordersById.get(orderId);
}

export function getLatestOrder(chatId: string): Order | undefined {
  const ids = ordersByChat.get(chatId);
  if (!ids?.length) return undefined;
  return ordersById.get(ids[0]);
}

export function getOrdersForChat(chatId: string): Order[] {
  const ids = ordersByChat.get(chatId) ?? [];
  return ids
    .map((id) => ordersById.get(id))
    .filter((order): order is Order => Boolean(order));
}

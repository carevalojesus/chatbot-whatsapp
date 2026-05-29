import { isFirebaseEnabled } from "../firebase/admin.js";
import * as firestoreStore from "./firestore.js";
import * as memoryStore from "./memory.js";
import type { CreateOrderInput, Order, OrderStatus } from "./types.js";

const store = isFirebaseEnabled() ? firestoreStore : memoryStore;

export type { CreateOrderInput, Order, OrderStatus } from "./types.js";

export const createOrder = (input: CreateOrderInput): Promise<Order> =>
  store.createOrder(input);

export const getOrder = (orderId: string): Promise<Order | undefined> =>
  store.getOrder(orderId);

export const getLatestOrder = (chatId: string): Promise<Order | undefined> =>
  store.getLatestOrder(chatId);

export const getOrdersForChat = (chatId: string): Promise<Order[]> =>
  store.getOrdersForChat(chatId);

export const updateOrderStatus = (
  orderId: string,
  status: OrderStatus,
): Promise<Order | undefined> => store.updateOrderStatus(orderId, status);

export const getPendingOrders = (): Promise<Order[]> =>
  store.getPendingOrders();

export const cancelOrder = (
  orderId: string,
  by: "cliente" | "admin",
): Promise<Order | undefined> => store.cancelOrder(orderId, by);

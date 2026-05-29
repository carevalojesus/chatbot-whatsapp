import type { Firestore } from "firebase-admin/firestore";
import { config } from "../config.js";

export function restaurantDoc(db: Firestore) {
  return db.collection("restaurants").doc(config.restaurant.id);
}

export function menuDoc(db: Firestore) {
  return restaurantDoc(db).collection("menu").doc("current");
}

export function ordersCollection(db: Firestore) {
  return restaurantDoc(db).collection("orders");
}

export function sessionsCollection(db: Firestore) {
  return restaurantDoc(db).collection("sessions");
}

export function countersDoc(db: Firestore) {
  return restaurantDoc(db).collection("meta").doc("counters");
}

export function customersCollection(db: Firestore) {
  return restaurantDoc(db).collection("customers");
}

export function customerAddressesCollection(db: Firestore, customerId: string) {
  return customersCollection(db).doc(customerId).collection("addresses");
}

export function customerChatIndex(db: Firestore) {
  return restaurantDoc(db).collection("customerChats");
}

export function sessionDocId(chatId: string): string {
  return chatId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function chatIndexDocId(chatId: string): string {
  return sessionDocId(chatId);
}

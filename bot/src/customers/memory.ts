import type { Customer, CustomerAddress } from "./types.js";
import { MAX_ADDRESSES } from "./types.js";

const customersById = new Map<string, Customer>();
const chatToCustomer = new Map<string, string>();
const addressesByCustomer = new Map<string, CustomerAddress[]>();

function deriveCustomerId(chatId: string): string {
  if (chatId.endsWith("@c.us")) {
    const digits = chatId.split("@")[0]?.replace(/\D/g, "") ?? "";
    if (digits.length >= 9) {
      return digits;
    }
  }
  return `chat_${chatId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export async function getCustomerByChatId(
  chatId: string,
): Promise<Customer | undefined> {
  const customerId = chatToCustomer.get(chatId);
  if (!customerId) {
    return undefined;
  }
  return customersById.get(customerId);
}

export async function getOrCreateCustomer(
  chatId: string,
  name?: string,
): Promise<Customer> {
  const existing = await getCustomerByChatId(chatId);
  if (existing) {
    if (!existing.chatIds.includes(chatId)) {
      existing.chatIds.push(chatId);
    }
    if (name && !existing.name) {
      existing.name = name;
    }
    return existing;
  }

  const customerId = deriveCustomerId(chatId);
  const customer: Customer = {
    id: customerId,
    chatIds: [chatId],
    phone: chatId.endsWith("@c.us") ? customerId : undefined,
    name: name?.trim() ?? "",
    orderCount: 0,
    registeredAt: new Date(),
  };

  customersById.set(customerId, customer);
  chatToCustomer.set(chatId, customerId);
  return customer;
}

export async function updateCustomerName(
  customerId: string,
  name: string,
): Promise<void> {
  const customer = customersById.get(customerId);
  if (customer) {
    customer.name = name.trim();
  }
}

export async function recordCustomerOrder(customerId: string): Promise<void> {
  const customer = customersById.get(customerId);
  if (customer) {
    customer.orderCount += 1;
    customer.lastOrderAt = new Date();
  }
}

export async function listAddresses(
  customerId: string,
): Promise<CustomerAddress[]> {
  return addressesByCustomer.get(customerId) ?? [];
}

export async function addAddress(
  customerId: string,
  alias: string,
  line: string,
  setDefault = false,
): Promise<CustomerAddress> {
  const existing = addressesByCustomer.get(customerId) ?? [];

  if (existing.length >= MAX_ADDRESSES) {
    throw new Error("MAX_ADDRESSES");
  }

  if (
    existing.some((entry) => entry.alias.toLowerCase() === alias.toLowerCase())
  ) {
    throw new Error("DUPLICATE_ALIAS");
  }

  const address: CustomerAddress = {
    id: `addr_${Date.now()}`,
    alias: alias.trim(),
    line: line.trim(),
    isDefault: setDefault || existing.length === 0,
    createdAt: new Date(),
  };

  if (address.isDefault) {
    for (const entry of existing) {
      entry.isDefault = false;
    }
  }

  existing.push(address);
  addressesByCustomer.set(customerId, existing);
  return address;
}

export async function deleteAddress(
  customerId: string,
  addressId: string,
): Promise<boolean> {
  const existing = addressesByCustomer.get(customerId) ?? [];
  const next = existing.filter((entry) => entry.id !== addressId);
  if (next.length === existing.length) {
    return false;
  }
  addressesByCustomer.set(customerId, next);
  return true;
}

export async function getCustomer(
  customerId: string,
): Promise<Customer | undefined> {
  return customersById.get(customerId);
}

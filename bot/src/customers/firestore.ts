import {
  FieldValue,
  Timestamp,
  type DocumentData,
} from "firebase-admin/firestore";
import { getDb } from "../firebase/admin.js";
import {
  chatIndexDocId,
  customerAddressesCollection,
  customerChatIndex,
  customersCollection,
  sessionDocId,
} from "../firebase/paths.js";
import type { Customer, CustomerAddress } from "./types.js";
import { MAX_ADDRESSES } from "./types.js";

function extractPhoneFromChatId(chatId: string): string | undefined {
  if (!chatId.endsWith("@c.us")) {
    return undefined;
  }
  const digits = chatId.split("@")[0]?.replace(/\D/g, "") ?? "";
  return digits.length >= 9 ? digits : undefined;
}

function deriveCustomerId(chatId: string): string {
  return extractPhoneFromChatId(chatId) ?? `chat_${sessionDocId(chatId)}`;
}

function mapCustomer(id: string, data: DocumentData): Customer {
  const registeredAt = data.registeredAt;
  const lastOrderAt = data.lastOrderAt;
  return {
    id,
    chatIds: data.chatIds ?? [],
    phone: data.phone,
    name: data.name ?? "",
    orderCount: data.orderCount ?? 0,
    registeredAt:
      registeredAt instanceof Timestamp
        ? registeredAt.toDate()
        : new Date(registeredAt ?? Date.now()),
    lastOrderAt:
      lastOrderAt instanceof Timestamp
        ? lastOrderAt.toDate()
        : lastOrderAt
          ? new Date(lastOrderAt)
          : undefined,
  };
}

function mapAddress(id: string, data: DocumentData): CustomerAddress {
  const createdAt = data.createdAt;
  return {
    id,
    alias: data.alias,
    line: data.line,
    isDefault: data.isDefault ?? false,
    createdAt:
      createdAt instanceof Timestamp
        ? createdAt.toDate()
        : new Date(createdAt ?? Date.now()),
  };
}

export async function getCustomerByChatId(
  chatId: string,
): Promise<Customer | undefined> {
  const db = getDb();
  const indexSnap = await customerChatIndex(db).doc(chatIndexDocId(chatId)).get();
  if (!indexSnap.exists) {
    return undefined;
  }

  const customerId = indexSnap.data()?.customerId as string;
  const customerSnap = await customersCollection(db).doc(customerId).get();
  if (!customerSnap.exists) {
    return undefined;
  }

  return mapCustomer(customerSnap.id, customerSnap.data()!);
}

async function linkChatToCustomer(
  customerId: string,
  chatId: string,
): Promise<void> {
  const db = getDb();
  const ref = customersCollection(db).doc(customerId);
  await ref.set(
    {
      chatIds: FieldValue.arrayUnion(chatId),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await customerChatIndex(db)
    .doc(chatIndexDocId(chatId))
    .set({ customerId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function getOrCreateCustomer(
  chatId: string,
  name?: string,
): Promise<Customer> {
  const existing = await getCustomerByChatId(chatId);
  if (existing) {
    await linkChatToCustomer(existing.id, chatId);
    if (name && !existing.name) {
      await updateCustomerName(existing.id, name);
      existing.name = name;
    }
    return existing;
  }

  const db = getDb();
  const customerId = deriveCustomerId(chatId);
  const phone = extractPhoneFromChatId(chatId);

  const customer: Customer = {
    id: customerId,
    chatIds: [chatId],
    phone,
    name: name?.trim() ?? "",
    orderCount: 0,
    registeredAt: new Date(),
  };

  await customersCollection(db).doc(customerId).set({
    ...customer,
    registeredAt: FieldValue.serverTimestamp(),
  });
  await customerChatIndex(db)
    .doc(chatIndexDocId(chatId))
    .set({ customerId, updatedAt: FieldValue.serverTimestamp() });

  return customer;
}

export async function updateCustomerName(
  customerId: string,
  name: string,
): Promise<void> {
  await customersCollection(getDb()).doc(customerId).set(
    {
      name: name.trim(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function recordCustomerOrder(customerId: string): Promise<void> {
  await customersCollection(getDb()).doc(customerId).set(
    {
      orderCount: FieldValue.increment(1),
      lastOrderAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function listAddresses(
  customerId: string,
): Promise<CustomerAddress[]> {
  const snap = await customerAddressesCollection(getDb(), customerId)
    .orderBy("createdAt", "asc")
    .get();

  return snap.docs.map((doc) => mapAddress(doc.id, doc.data()));
}

export async function addAddress(
  customerId: string,
  alias: string,
  line: string,
  setDefault = false,
): Promise<CustomerAddress> {
  const db = getDb();
  const collection = customerAddressesCollection(db, customerId);
  const existing = await listAddresses(customerId);

  if (existing.length >= MAX_ADDRESSES) {
    throw new Error("MAX_ADDRESSES");
  }

  const duplicate = existing.find(
    (entry) => entry.alias.toLowerCase() === alias.toLowerCase(),
  );
  if (duplicate) {
    throw new Error("DUPLICATE_ALIAS");
  }

  if (setDefault || existing.length === 0) {
    for (const address of existing) {
      if (address.isDefault) {
        await collection.doc(address.id).update({ isDefault: false });
      }
    }
  }

  const ref = collection.doc();
  const address: CustomerAddress = {
    id: ref.id,
    alias: alias.trim(),
    line: line.trim(),
    isDefault: setDefault || existing.length === 0,
    createdAt: new Date(),
  };

  await ref.set({
    ...address,
    createdAt: FieldValue.serverTimestamp(),
  });

  return address;
}

export async function deleteAddress(
  customerId: string,
  addressId: string,
): Promise<boolean> {
  const ref = customerAddressesCollection(getDb(), customerId).doc(addressId);
  const snap = await ref.get();
  if (!snap.exists) {
    return false;
  }
  await ref.delete();
  return true;
}

export async function getCustomer(
  customerId: string,
): Promise<Customer | undefined> {
  const snap = await customersCollection(getDb()).doc(customerId).get();
  if (!snap.exists) {
    return undefined;
  }
  return mapCustomer(snap.id, snap.data()!);
}

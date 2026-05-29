import { isFirebaseEnabled } from "../firebase/admin.js";
import * as firestoreStore from "./firestore.js";
import * as memoryStore from "./memory.js";

const store = isFirebaseEnabled() ? firestoreStore : memoryStore;

export type { Customer, CustomerAddress } from "./types.js";
export { MAX_ADDRESSES } from "./types.js";

export const getCustomerByChatId = (chatId: string) =>
  store.getCustomerByChatId(chatId);

export const getOrCreateCustomer = (chatId: string, name?: string) =>
  store.getOrCreateCustomer(chatId, name);

export const updateCustomerName = (customerId: string, name: string) =>
  store.updateCustomerName(customerId, name);

export const recordCustomerOrder = (customerId: string) =>
  store.recordCustomerOrder(customerId);

export const listAddresses = (customerId: string) =>
  store.listAddresses(customerId);

export const addAddress = (
  customerId: string,
  alias: string,
  line: string,
  setDefault?: boolean,
) => store.addAddress(customerId, alias, line, setDefault);

export const deleteAddress = (customerId: string, addressId: string) =>
  store.deleteAddress(customerId, addressId);

export const getCustomer = (customerId: string) => store.getCustomer(customerId);

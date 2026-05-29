export interface Customer {
  id: string;
  chatIds: string[];
  phone?: string;
  name: string;
  orderCount: number;
  registrationSkipped?: boolean;
  registeredAt: Date;
  lastOrderAt?: Date;
}

export interface CustomerAddress {
  id: string;
  alias: string;
  line: string;
  isDefault: boolean;
  createdAt: Date;
}

export const MAX_ADDRESSES = 5;

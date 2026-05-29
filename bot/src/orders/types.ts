export type OrderStatus =
  | "pendiente"
  | "confirmado"
  | "entregado"
  | "cancelado";

export type PaymentMethod = "yape" | "plin" | "transferencia" | "efectivo";

export interface Order {
  id: string;
  chatId: string;
  customerId?: string;
  customerName?: string;
  items: Array<{
    itemId: string;
    name: string;
    unitPrice: number;
    quantity: number;
  }>;
  deliveryType: "domicilio" | "recoger";
  address?: string;
  addressAlias?: string;
  paymentMethod?: PaymentMethod;
  cashPaid?: number;
  changeDue?: number;
  paymentProofReceived?: boolean;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  cancelledBy?: "cliente" | "admin";
  validationToken?: string;
  validatedAt?: Date;
  validatedBy?: string;
  createdAt: Date;
}

export type CreateOrderInput = Omit<Order, "id" | "createdAt">;

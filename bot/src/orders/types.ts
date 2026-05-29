export type OrderStatus =
  | "pendiente"
  | "confirmado"
  | "entregado"
  | "cancelado";

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
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  cancelledBy?: "cliente" | "admin";
  createdAt: Date;
}

export type CreateOrderInput = Omit<Order, "id" | "createdAt">;

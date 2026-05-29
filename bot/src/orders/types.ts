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

export type CreateOrderInput = Omit<Order, "id" | "createdAt">;

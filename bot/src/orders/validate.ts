import type { Order } from "./types.js";

export type ValidateOrderError =
  | "not_found"
  | "cancelado"
  | "already_validated"
  | "invalid_token";

export type ValidateOrderResult =
  | { ok: true; order: Order }
  | { ok: false; error: ValidateOrderError; order?: Order };

export function isValidatableStatus(status: Order["status"]): boolean {
  return status === "pendiente" || status === "confirmado";
}

import { config } from "../config.js";
import { getRestaurantProfile } from "./profile.js";
import { normalizeText } from "../utils/format.js";

export interface DeliveryValidation {
  valid: boolean;
  message?: string;
}

export function validateDeliveryAddress(address: string): DeliveryValidation {
  if (!config.restaurant.validateDeliveryZone) {
    return { valid: true };
  }

  const keywords = config.restaurant.deliveryKeywords;
  if (!keywords.length) {
    return { valid: true };
  }

  const normalized = normalizeText(address);
  const matched = keywords.some((keyword) => normalized.includes(keyword));

  if (matched) {
    return { valid: true };
  }

  const zone = getRestaurantProfile().deliveryZone;
  return {
    valid: false,
    message: `📍 *Zona fuera de cobertura*

Por ahora solo delivery en: *${zone}*

Escribe otra dirección dentro de la zona, elige *recoger en local*, o *0* para volver.`,
  };
}

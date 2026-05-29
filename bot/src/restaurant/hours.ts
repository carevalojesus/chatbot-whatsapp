import { config } from "../config.js";
import { getRestaurantProfile } from "./profile.js";

export interface OpenStatus {
  open: boolean;
  message?: string;
}

function nowInTimezone(): Date {
  const tz = config.restaurant.timezone;
  const formatted = new Date().toLocaleString("en-US", { timeZone: tz });
  return new Date(formatted);
}

function parseTime(value: string): { hour: number; minute: number } | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function minutesSinceMidnight(hour: number, minute: number): number {
  return hour * 60 + minute;
}

export function isRestaurantOpen(): OpenStatus {
  if (!config.restaurant.enforceHours) {
    return { open: true };
  }

  const now = nowInTimezone();
  const day = now.getDay();
  if (config.restaurant.closedDays.includes(day)) {
    return {
      open: false,
      message: formatClosedMessage(),
    };
  }

  const openTime = parseTime(config.restaurant.openTime);
  const closeTime = parseTime(config.restaurant.closeTime);
  if (!openTime || !closeTime) {
    return { open: true };
  }

  const current = minutesSinceMidnight(now.getHours(), now.getMinutes());
  const openAt = minutesSinceMidnight(openTime.hour, openTime.minute);
  const closeAt = minutesSinceMidnight(closeTime.hour, closeTime.minute);

  if (current < openAt || current >= closeAt) {
    return {
      open: false,
      message: formatClosedMessage(),
    };
  }

  return { open: true };
}

export function formatClosedMessage(): string {
  const profile = getRestaurantProfile();
  return `🕐 *Estamos cerrados en este momento.*

Horario: ${profile.schedule}

Puedes ver la carta (opción *1*) y volver a pedir cuando abramos.`;
}

export function closedOrderBlockMessage(): string {
  const status = isRestaurantOpen();
  return status.message ?? formatClosedMessage();
}

import { getRestaurantProfile } from "../restaurant/profile.js";

export function formatCurrency(amount: number): string {
  const { currency } = getRestaurantProfile();
  const locale = currency === "PEN" ? "es-PE" : "es-CO";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "PEN" ? 2 : 0,
  }).format(amount);
}

export function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function parseAmount(text: string): number | null {
  const cleaned = text.trim().replace(/[^\d.,]/g, "").replace(",", ".");
  if (!cleaned) return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;

  return Math.round(value * 100) / 100;
}

export function parseChoice(text: string, max: number): number | null {
  const normalized = normalizeText(text);
  const match = normalized.match(/^(\d+)/);
  if (!match) return null;

  const value = Number(match[1]);
  if (value < 1 || value > max) return null;
  return value;
}

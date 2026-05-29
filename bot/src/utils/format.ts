export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function parseChoice(text: string, max: number): number | null {
  const normalized = normalizeText(text);
  const match = normalized.match(/^(\d+)/);
  if (!match) return null;

  const value = Number(match[1]);
  if (value < 1 || value > max) return null;
  return value;
}

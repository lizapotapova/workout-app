/** Turns typed text like "62,5" or "62.5" into a number. Returns null if it isn't a valid number. */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** A weight is valid if it's a number that is 0 or more (0 is for bodyweight exercises). */
export function parseWeight(text: string): number | null {
  const value = parseNumber(text);
  return value !== null && value >= 0 ? value : null;
}

/** Reps are valid if they are a whole number that is 1 or more. */
export function parseReps(text: string): number | null {
  const value = parseNumber(text);
  return value !== null && value >= 1 && Number.isInteger(value) ? value : null;
}

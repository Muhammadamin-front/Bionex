/**
 * Customer name normalization.
 *
 * Accepts Latin and Cyrillic letters (Uzbek, Russian, Karakalpak…), spaces, hyphens,
 * dots and the apostrophe variants people actually type for oʻ / gʻ / tutuq belgisi:
 * ' ` ʻ ʼ ‘ ’. Digits, URLs, emoji and control characters are rejected.
 */

export const NAME_MIN_LETTERS = 2;
export const NAME_MAX_LENGTH = 80;

export type NameErrorReason = 'empty' | 'too_short' | 'too_long' | 'invalid_chars';
export type NameResult = { ok: true; value: string } | { ok: false; reason: NameErrorReason };

const APOSTROPHES = "'`ʻʼ‘’";
const ALLOWED = new RegExp(`^[\\p{L}\\p{M}][\\p{L}\\p{M} .\\-${APOSTROPHES}]*$`, 'u');
const LETTER = /\p{L}/gu;

export function normalizeName(input: string): NameResult {
  const value = input.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (value.length === 0) return { ok: false, reason: 'empty' };
  // Count code points, not UTF-16 units, so Cyrillic and combined letters are fair.
  if ([...value].length > NAME_MAX_LENGTH) return { ok: false, reason: 'too_long' };
  if (!ALLOWED.test(value)) return { ok: false, reason: 'invalid_chars' };
  if ((value.match(LETTER)?.length ?? 0) < NAME_MIN_LETTERS) return { ok: false, reason: 'too_short' };
  return { ok: true, value };
}

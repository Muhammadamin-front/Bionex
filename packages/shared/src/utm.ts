/**
 * Campaign attribution (UTM) parameters.
 *
 * UTM values come from ad-platform URLs, so they are sanitized rather than
 * rejected: an odd utm_content value must never cost us a real order.
 */

export const UTM_KEYS = ['source', 'medium', 'campaign', 'content'] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Utm = Partial<Record<UtmKey, string>>;

export const UTM_MAX_LENGTH = 150;

const DISALLOWED = /[^\p{L}\p{N} _.\-|/:+]/gu;
// A leading = + - @ can be interpreted as a formula if a sheet is ever exported to CSV.
const FORMULA_PREFIX = /^[=+\-@\s]+/;

export function sanitizeUtmValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value
    .normalize('NFKC')
    .replace(DISALLOWED, '')
    .replace(FORMULA_PREFIX, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, UTM_MAX_LENGTH)
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function sanitizeUtm(input: Partial<Record<string, unknown>> | undefined | null): Utm {
  const out: Utm = {};
  if (!input) return out;
  for (const key of UTM_KEYS) {
    const v = sanitizeUtmValue(input[key]);
    if (v) out[key] = v;
  }
  return out;
}

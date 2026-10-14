/**
 * Uzbekistan phone number normalization.
 *
 * Every phone number is stored in one canonical form — E.164, e.g. "+998901234567" —
 * so "90 123 45 67", "+998 (90) 123-45-67" and "998901234567" are recognised as the
 * same customer. Duplicate detection depends on this.
 */

export const UZ_COUNTRY_CODE = '998';

/**
 * Two-digit operator / area codes accepted by default (mobile operators plus
 * regional landline codes). Override on the server with PHONE_ALLOWED_PREFIXES
 * when a new operator code is introduced.
 */
export const DEFAULT_UZ_PREFIXES: readonly string[] = [
  // mobile: 20 OQ, 33 Humans, 50/93/94 Ucell, 55 Ucell/Uztelecom, 77/95/99 Uzmobile,
  // 80/98 Perfectum, 87/88/97 Mobiuz, 90/91 Beeline, 92 Beeline (old range)
  '20', '33', '50', '55', '77', '80', '87', '88', '90', '91', '92', '93', '94', '95', '97', '98', '99',
  // regional landlines
  '61', '62', '65', '66', '67', '69', '70', '71', '72', '73', '74', '75', '76', '78', '79',
];

export type PhoneErrorReason =
  | 'empty'
  | 'too_long'
  | 'invalid_chars'
  | 'invalid_length'
  | 'invalid_prefix';

export type PhoneResult =
  | { ok: true; e164: string; national: string }
  | { ok: false; reason: PhoneErrorReason };

const MAX_RAW_LENGTH = 32;
const ALLOWED_RAW = /^\+?[\d\s\-().]+$/;

export function normalizeUzPhone(
  input: string,
  allowedPrefixes: readonly string[] = DEFAULT_UZ_PREFIXES,
): PhoneResult {
  // NFKC turns full-width digits (e.g. from some mobile keyboards) into ASCII.
  const raw = input.normalize('NFKC').trim();
  if (raw.length === 0) return { ok: false, reason: 'empty' };
  if (raw.length > MAX_RAW_LENGTH) return { ok: false, reason: 'too_long' };
  if (!ALLOWED_RAW.test(raw)) return { ok: false, reason: 'invalid_chars' };

  const digits = raw.replace(/\D/g, '');
  let national: string;
  if (digits.length === 12 && digits.startsWith(UZ_COUNTRY_CODE)) {
    national = digits.slice(3);
  } else if (digits.length === 14 && digits.startsWith('00' + UZ_COUNTRY_CODE)) {
    national = digits.slice(5);
  } else if (digits.length === 10 && digits.startsWith('8') && !raw.startsWith('+')) {
    // Legacy domestic trunk prefix: "8 (90) 123-45-67".
    national = digits.slice(1);
  } else if (digits.length === 9 && !raw.startsWith('+')) {
    national = digits;
  } else {
    return { ok: false, reason: 'invalid_length' };
  }

  if (!/^[2-9]\d{8}$/.test(national)) return { ok: false, reason: 'invalid_length' };
  if (!allowedPrefixes.includes(national.slice(0, 2))) {
    return { ok: false, reason: 'invalid_prefix' };
  }
  return { ok: true, e164: `+${UZ_COUNTRY_CODE}${national}`, national };
}

/** "+998901234567" → "+998 90 123 45 67" */
export function formatUzPhone(e164: string): string {
  const n = e164.replace(/^\+998/, '');
  if (n.length !== 9) return e164;
  return `+998 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
}

/** "+998901234567" → "+998 90 *** ** 67" — for logs and lists where the full number is not needed. */
export function maskUzPhone(e164: string): string {
  const n = e164.replace(/^\+998/, '');
  if (n.length !== 9) return '***';
  return `+998 ${n.slice(0, 2)} *** ** ${n.slice(7)}`;
}

/**
 * Formats partial input while the customer types the 9 national digits.
 * "901234" → "90 123 4"
 */
export function formatNationalAsTyped(digits: string): string {
  const d = digits.slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)];
  return parts.filter(Boolean).join(' ');
}

/**
 * Turns what someone typed or pasted into the phone field (which already shows "+998")
 * into the 9 national digits, and reports how many leading digits were dropped.
 *
 * Handles the habits older customers actually have:
 *  - "+998 90 123 45 67" / "998901234567" — country code typed again;
 *  - "8 (90) 123-45-67" — the old domestic trunk prefix. The leading 8 is only dropped
 *    when it makes the number valid; codes 80/87/88 genuinely start with 8.
 */
export function nationalDigitsFromInput(
  raw: string,
  allowedPrefixes: readonly string[] = DEFAULT_UZ_PREFIXES,
): { digits: string; dropped: number } {
  const all = raw.normalize('NFKC').replace(/\D/g, '');
  if (all.length > 9 && all.startsWith(UZ_COUNTRY_CODE)) return { digits: all.slice(3, 12), dropped: 3 };
  if (all.length === 10 && all.startsWith('8')) {
    const stripped = all.slice(1);
    const strippedOk = allowedPrefixes.includes(stripped.slice(0, 2));
    const asTypedOk = allowedPrefixes.includes(all.slice(0, 2));
    if (strippedOk && (!asTypedOk || all[1] === '8')) return { digits: stripped, dropped: 1 };
  }
  return { digits: all.slice(0, 9), dropped: 0 };
}

/** Index in the formatted string ("90 123 45 67") just after the n-th digit. */
export function caretAfterDigits(formatted: string, n: number): number {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!) && ++seen === n) return i + 1;
  }
  return formatted.length;
}

/**
 * Heuristic risk signal only — never a reason to reject. Vanity numbers such as
 * 90 777 77 77 are real and sold by operators.
 */
export function phoneLooksSynthetic(national: string): boolean {
  const subscriber = national.slice(2);
  if (/^(\d)\1{6}$/.test(subscriber)) return true;
  return subscriber === '1234567' || subscriber === '7654321';
}

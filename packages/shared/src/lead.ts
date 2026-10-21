import { z } from 'zod';
import { HONEYPOT_FIELD } from './constants';
import { cleanDeviceModel, cleanSignals } from './device';
import { normalizeName, type NameErrorReason } from './name';
import { DEFAULT_UZ_PREFIXES, normalizeUzPhone, type PhoneErrorReason } from './phone';
import { sanitizeUtm, UTM_KEYS } from './utm';

export { HONEYPOT_FIELD, TURNSTILE_ACTION } from './constants';

// Zod normally probes `new Function()` to JIT-compile parsers. Under the site's strict
// Content-Security-Policy that probe is blocked and logged as a violation on every load;
// jitless mode skips it (the forms are tiny, so speed is unaffected).
z.config({ jitless: true });

export const NAME_MESSAGES: Record<NameErrorReason, string> = {
  empty: 'Исмингизни киритинг',
  too_short: 'Исм камида 2 та ҳарфдан иборат бўлиши керак',
  too_long: 'Исм жуда узун (кўпи билан 80 та белги)',
  invalid_chars: 'Исмда фақат ҳарфлар, бўш жой ва чизиқча бўлиши мумкин',
};

export const PHONE_MESSAGES: Record<PhoneErrorReason, string> = {
  empty: 'Телефон рақамингизни киритинг',
  too_long: 'Телефон рақами нотўғри. Масалан: +998 90 123 45 67',
  invalid_chars: 'Телефон рақамида фақат рақамлар бўлиши керак',
  invalid_length: 'Телефон рақами нотўғри. Масалан: +998 90 123 45 67',
  invalid_prefix: 'Оператор коди нотўғри. Рақамни текширинг',
};

export const fullNameSchema = z
  .string({ error: NAME_MESSAGES.empty })
  .max(400, NAME_MESSAGES.too_long)
  .transform((value, ctx) => {
    const result = normalizeName(value);
    if (!result.ok) {
      ctx.issues.push({ code: 'custom', message: NAME_MESSAGES[result.reason], input: value });
      return z.NEVER;
    }
    return result.value;
  });

/** Returns the phone number in E.164 form ("+998901234567"). */
export function makePhoneSchema(allowedPrefixes: readonly string[] = DEFAULT_UZ_PREFIXES) {
  return z
    .string({ error: PHONE_MESSAGES.empty })
    .max(64, PHONE_MESSAGES.too_long)
    .transform((value, ctx) => {
      const result = normalizeUzPhone(value, allowedPrefixes);
      if (!result.ok) {
        ctx.issues.push({ code: 'custom', message: PHONE_MESSAGES[result.reason], input: value });
        return z.NEVER;
      }
      return result.e164;
    });
}

export const phoneSchema = makePhoneSchema();

const utmInputSchema = z
  .strictObject(Object.fromEntries(UTM_KEYS.map((k) => [k, z.string().max(500).optional()])))
  .optional()
  .transform((v) => sanitizeUtm(v));

/** A random id the browser makes for one order attempt (UUID v4). */
export const SUBMISSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Body of POST /api/leads. Strict: unknown keys are rejected.
 *
 * `submissionId` is passed to Turnstile as cData, so a Turnstile token only counts for the
 * order attempt it was issued for; it also makes a retry after a lost answer idempotent.
 * turnstileToken is optional *in the schema* only so that a missing token is reported as a
 * Turnstile failure instead of a generic validation error. The server still requires it.
 */
export function makeLeadSubmissionSchema(opts: { phonePrefixes?: readonly string[] } = {}) {
  return z.strictObject({
    fullName: fullNameSchema,
    phone: makePhoneSchema(opts.phonePrefixes),
    submissionId: z.string().regex(SUBMISSION_ID_PATTERN),
    /** The browser's own random id (apps/web lib/device.ts), so spam can be traced to a phone. */
    deviceId: z.string().regex(SUBMISSION_ID_PATTERN).optional(),
    /** A SHA-256 (hex) of what the browser reports about the phone (apps/web lib/device.ts). */
    fingerprint: z.string().regex(/^[0-9a-f]{64}$/).optional(),
    /** The phone's model as the browser names it (device.ts); cleaned, never a reason to refuse. */
    deviceModel: z.string().max(200).optional().transform(cleanDeviceModel),
    /** What tells a phone from a computer, a person from a program (device.ts); never refused. */
    signals: z.unknown().optional().transform(cleanSignals),
    turnstileToken: z.string().max(2048).optional(),
    [HONEYPOT_FIELD]: z.string().max(500).optional(),
    utm: utmInputSchema,
  });
}

export type LeadSubmissionInput = z.input<ReturnType<typeof makeLeadSubmissionSchema>>;
export type LeadSubmission = z.output<ReturnType<typeof makeLeadSubmissionSchema>>;

// ── API contract ─────────────────────────────────────────────────────────

export type ApiErrorCode =
  | 'validation_failed'
  | 'turnstile_failed'
  | 'rate_limited'
  | 'unavailable'
  | 'forbidden'
  | 'not_found'
  | 'internal';

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Per-field messages for validation errors, keyed by field name. */
    fields?: Record<string, string>;
  };
}

/**
 * Deliberately says nothing about Meta. Reporting an order is the Worker's job and happens
 * only once an operator has rung the customer, so the browser has no part to play and is
 * never asked to send a `Lead` of its own.
 */
export interface LeadSubmitResponse {
  status: 'accepted' | 'duplicate';
  message: string;
}

import { TURNSTILE_ACTION } from '@bionex/shared/constants';

/** Test keys from https://developers.cloudflare.com/turnstile/troubleshooting/testing/ */
const TEST_SECRET = /^[123]x0000000000000000000000000000000AA$/;
/** What the widget returns when the site was built with a TEST site key. */
const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

/** Error codes that mean *our* configuration is wrong — every order fails until it is fixed. */
export const CONFIG_ERRORS = new Set(['invalid-input-secret', 'test-sitekey-in-production', 'hostname-mismatch']);

export interface TurnstileResult {
  ok: boolean;
  errors: string[];
}

export class TurnstileUnavailable extends Error {}

/**
 * Asks Cloudflare whether the token is genuine. The token alone proves nothing: it must be
 * fresh, unused, issued for our form action, for this exact order attempt (cData) and on
 * our own site (hostname).
 */
export async function verifyTurnstile(opts: {
  secret: string;
  token: string;
  ip: string;
  submissionId: string;
  hostname: string;
  verifyUrl?: string;
}): Promise<TurnstileResult> {
  if (opts.token === DUMMY_TOKEN && !TEST_SECRET.test(opts.secret)) {
    return { ok: false, errors: ['test-sitekey-in-production'] };
  }
  const form = new FormData();
  form.append('secret', opts.secret);
  form.append('response', opts.token);
  form.append('remoteip', opts.ip);
  form.append('idempotency_key', opts.submissionId);
  let data: { success?: boolean; 'error-codes'?: string[]; action?: string; cdata?: string; hostname?: string };
  try {
    const res = await fetch(opts.verifyUrl ?? 'https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`siteverify ${res.status}`);
    data = await res.json();
  } catch {
    throw new TurnstileUnavailable();
  }
  if (!data.success) return { ok: false, errors: data['error-codes']?.length ? data['error-codes'] : ['unknown'] };
  // Cloudflare's test secrets answer with placeholder action/cdata/hostname; only check real ones.
  if (TEST_SECRET.test(opts.secret)) return { ok: true, errors: [] };
  const errors: string[] = [];
  if (data.action !== TURNSTILE_ACTION) errors.push('action-mismatch');
  if (data.cdata !== opts.submissionId) errors.push('cdata-mismatch');
  if ((data.hostname ?? '').toLowerCase() !== opts.hostname.toLowerCase()) errors.push('hostname-mismatch');
  return { ok: errors.length === 0, errors };
}

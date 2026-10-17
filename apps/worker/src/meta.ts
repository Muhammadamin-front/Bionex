/**
 * Meta Conversions API — the same "Lead" the browser pixel reports, sent again from here.
 *
 * Why both: the browser copy is lost whenever an ad blocker, a privacy browser or iOS
 * tracking protection stops fbq from loading, and on Instagram's in-app browser that is a
 * large share of the traffic. This copy always leaves the server, so Meta's optimisation
 * sees every order and can learn who actually buys. Meta de-duplicates the two by event_id:
 * both send the order's submissionId, so one order is never counted twice.
 *
 * Privacy: Meta is given a one-way SHA-256 of the phone number and first name (the form it
 * requires for matching — it can confirm a match, not read the number). Nothing is stored
 * here; the hashes are made for the one request and thrown away. Turned off completely
 * unless both META_PIXEL_ID and META_CAPI_TOKEN are set.
 */

const API_VERSION = 'v21.0';

export interface MetaConfig {
  pixelId: string;
  token: string;
  /** Test override for the Graph API host. */
  apiBase?: string;
  /** Events Manager → Test events: shows the event there instead of counting it. */
  testEventCode?: string;
}

export interface MetaLead {
  /** Also the browser pixel's eventID, so Meta merges the two into one Lead. */
  submissionId: string;
  /** E.164, e.g. "+998901234567". */
  phone: string;
  fullName: string;
  ip: string;
  userAgent: string | null;
  /** Raw Cookie header: _fbp / _fbc are what Meta matches best on. */
  cookie: string | null;
  /** The page the order was sent from. */
  sourceUrl: string;
  now: number;
}

export function metaConfig(env: Env): MetaConfig | null {
  if (!env.META_PIXEL_ID || !env.META_CAPI_TOKEN) return null;
  return {
    pixelId: env.META_PIXEL_ID,
    token: env.META_CAPI_TOKEN,
    apiBase: env.META_API_BASE || undefined,
    testEventCode: env.META_TEST_EVENT_CODE || undefined,
  };
}

/**
 * Best effort: a Lead that Meta refuses is logged and dropped, never retried into a second
 * event and never allowed to affect the customer's answer — the order is already safe in
 * the registry and on its way to the operators.
 */
export async function sendMetaLead(cfg: MetaConfig, lead: MetaLead): Promise<void> {
  const [ph, fn, ln, country] = await Promise.all([
    sha256(lead.phone.replace(/\D/g, '')),
    sha256(firstName(lead.fullName)),
    sha256(lastName(lead.fullName)),
    sha256('uz'),
  ]);

  const user_data: Record<string, string> = { ph, fn, country, client_ip_address: lead.ip };
  if (ln) user_data.ln = ln;
  if (lead.userAgent) user_data.client_user_agent = lead.userAgent;
  const fbp = cookie(lead.cookie, '_fbp');
  const fbc = cookie(lead.cookie, '_fbc');
  if (fbp) user_data.fbp = fbp;
  if (fbc) user_data.fbc = fbc;

  const body = {
    // The access token travels in the body, never in the URL (URLs end up in logs).
    access_token: cfg.token,
    ...(cfg.testEventCode ? { test_event_code: cfg.testEventCode } : {}),
    data: [
      {
        event_name: 'Lead',
        event_time: Math.floor(lead.now / 1000),
        event_id: lead.submissionId,
        event_source_url: lead.sourceUrl,
        action_source: 'website',
        user_data,
        custom_data: { content_name: 'Zeynara', content_category: 'Health Supplement' },
      },
    ],
  };

  const url = `${cfg.apiBase ?? 'https://graph.facebook.com'}/${API_VERSION}/${cfg.pixelId}/events`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // Meta's message names the bad field; the token itself is never echoed back.
      console.error(`Meta CAPI refused the Lead (${res.status})`, (await res.text()).slice(0, 300));
      return;
    }
    const data = (await res.json().catch(() => null)) as { events_received?: number } | null;
    if (data?.events_received !== 1) console.error('Meta CAPI accepted nothing', JSON.stringify(data)?.slice(0, 200));
  } catch (err) {
    console.error('Meta CAPI unreachable', (err as Error)?.message);
  }
}

/** Meta matches on lower-case, trimmed values hashed with SHA-256 and written as hex. */
async function sha256(value: string): Promise<string> {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? '';
const lastName = (full: string) => full.trim().split(/\s+/).slice(1).join(' ');

/** One cookie out of the request's Cookie header. */
function cookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim() || undefined;
  }
  return undefined;
}

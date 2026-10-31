/**
 * Meta Conversions API — the "Lead" that teaches the ads whom to look for.
 *
 * *When* it is sent is the whole point. Not when the form is submitted: anybody can type a
 * name and a number, and on this product most of them did — people after free advice, and
 * children. Every one of those used to become a Lead, so Meta learned to find more of them.
 * It is sent once an operator has rung the customer and pressed an outcome button, so only a
 * real person who answered the phone is ever reported (see registry.ts `button`).
 *
 * That means the match data has to be collected at submit time — the IP, the user agent and
 * Meta's own _fbp / _fbc cookies exist only during that request — and kept until the operator
 * decides. `buildUserData` makes it; the registry stores it; `sendMetaEvent` sends it with the
 * order's original time, hours or days later (Meta accepts events up to 7 days old).
 *
 * Privacy: Meta is given a one-way SHA-256 of the phone number and name (the form it requires
 * for matching — it can confirm a match, not read the number). Nothing here is stored; see the
 * registry for what it keeps and for how long.
 *
 * De-duplication: event_id is the order's submissionId, the same id the browser pixel would
 * use, so the two can never be counted twice. In practice the browser copy is now off whenever
 * this one is configured (see `track` in the order's answer).
 *
 * A sold order sends a second event, Purchase, with the order's worth. Lead and Purchase are
 * two different claims — "a real person" and "a paying person" — and keeping them separate is
 * what makes it possible to move the ads onto the second one later without losing the history
 * of the first. Its event_id carries a "-purchase" suffix so the pair is never de-duplicated
 * into one.
 */

import type { SiteId } from './sites';

const API_VERSION = 'v21.0';

export interface MetaConfig {
  pixelId: string;
  token: string;
  /** Test override for the Graph API host. */
  apiBase?: string;
  /** Events Manager → Test events: shows the event there instead of counting it. */
  testEventCode?: string;
  /**
   * What one sold order is worth, in `currency`. Unset (or not a positive number) means no
   * Purchase event is sent at all: a Purchase whose value is a guess would teach the ads to
   * chase a number nobody chose, which is worse than having no Purchase.
   */
  orderValue?: number;
  currency: string;
}

/** Who the customer is, as Meta wants it: hashes plus the browser's own advertising ids. */
export type MetaUserData = Record<string, string>;

/** What is known about the customer during the order request, before anything is hashed. */
export interface MetaIdentity {
  /** E.164, e.g. "+998901234567". */
  phone: string;
  fullName: string;
  ip: string;
  userAgent: string | null;
  /** Raw Cookie header: _fbp / _fbc are what Meta matches best on. */
  cookie: string | null;
  /** The ad click's fbclid as the page saw it: the click id when no _fbc cookie was set yet. */
  clickId?: string;
  /** When the order arrived (ms), for an fbc made from `clickId`. */
  now?: number;
  /** The browser's own random id (apps/web lib/device.ts): sent hashed as external_id. */
  deviceId?: string;
}

export interface MetaEvent {
  /**
   * 'Lead' — a prospect an operator reached and confirmed is real.
   * 'Purchase' — that prospect bought ("✅ Сотилди"), sent alongside the Lead.
   */
  eventName: 'Lead' | 'Purchase' | 'QualifiedLead';
  /** The order's submissionId, so one order is one event however often this runs. */
  eventId: string;
  userData: MetaUserData;
  /** When the customer ordered (ms), not when the operator pressed the button. */
  eventTime: number;
  /** The page the order was sent from. */
  sourceUrl: string;
  /** Purchase only: the order's worth, and the currency it is in. */
  value?: number;
  currency?: string;
}

/** The dataset an order's events go to: each site's own, never the other's (see sites.ts). */
export function metaConfig(env: Env, site: SiteId = 'main'): MetaConfig | null {
  const own =
    site === 't2'
      ? { pixelId: env.META_T2_PIXEL_ID, token: env.META_T2_CAPI_TOKEN, testEventCode: env.META_T2_TEST_EVENT_CODE }
      : { pixelId: env.META_PIXEL_ID, token: env.META_CAPI_TOKEN, testEventCode: env.META_TEST_EVENT_CODE };
  if (!own.pixelId || !own.token) return null;
  const orderValue = Number(env.META_ORDER_VALUE);
  return {
    pixelId: own.pixelId,
    token: own.token,
    apiBase: env.META_API_BASE || undefined,
    testEventCode: own.testEventCode || undefined,
    orderValue: Number.isFinite(orderValue) && orderValue > 0 ? orderValue : undefined,
    currency: env.META_CURRENCY || 'UZS',
  };
}

/**
 * The match data for one order, made during the order's own request. Hashing here (rather
 * than when the event is finally sent) means the plain phone number and name never have to
 * be kept anywhere for Meta's sake.
 */
export async function buildUserData(who: MetaIdentity): Promise<MetaUserData> {
  const [ph, fn, ln, country] = await Promise.all([
    sha256(who.phone.replace(/\D/g, '')),
    sha256(firstName(who.fullName)),
    sha256(lastName(who.fullName)),
    sha256('uz'),
  ]);

  const user_data: MetaUserData = { ph, fn, country, client_ip_address: who.ip };
  // external_id: one id per person across their events (the Lead now, the QualifiedLead later) —
  // the phone's device id when the page sent one, else the number itself. Hashed like the rest.
  user_data.external_id = await sha256(who.deviceId ? `device:${who.deviceId}` : who.phone.replace(/\D/g, ''));
  if (ln) user_data.ln = ln;
  if (who.userAgent) user_data.client_user_agent = who.userAgent;
  const fbp = cookie(who.cookie, '_fbp');
  // The Pixel loads only once the page is idle and sets _fbc then; a quick order, or a browser
  // that keeps no cookie, arrives without it. Meta's own format from the fbclid is the same click.
  const fbc = cookie(who.cookie, '_fbc') ?? (who.clickId ? `fb.1.${who.now ?? Date.now()}.${who.clickId}` : undefined);
  if (fbp) user_data.fbp = fbp;
  if (fbc) user_data.fbc = fbc;
  return user_data;
}

/**
 * Best effort: an event Meta refuses is logged and dropped, never retried into a second
 * event and never allowed to affect anything the operator or the customer sees — the order
 * is already safe in the registry and the outcome is already saved.
 */
/** True once Meta has taken the event; a refusal is logged (and alerted by the caller). */
export async function sendMetaEvent(cfg: MetaConfig, event: MetaEvent): Promise<boolean> {
  const body = {
    // The access token travels in the body, never in the URL (URLs end up in logs).
    access_token: cfg.token,
    ...(cfg.testEventCode ? { test_event_code: cfg.testEventCode } : {}),
    data: [
      {
        event_name: event.eventName,
        event_time: Math.floor(event.eventTime / 1000),
        event_id: event.eventId,
        event_source_url: event.sourceUrl,
        action_source: 'website',
        user_data: event.userData,
        custom_data: {
          content_name: 'Zeynara',
          content_category: 'Health Supplement',
          // Meta rejects a value without a currency, so the two only ever travel together.
          ...(event.value !== undefined && event.currency ? { value: event.value, currency: event.currency } : {}),
        },
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
      console.error(`Meta CAPI refused the ${event.eventName} (${res.status})`, (await res.text()).slice(0, 300));
      return false;
    }
    const data = (await res.json().catch(() => null)) as { events_received?: number } | null;
    if (data?.events_received === 1) return true;
    console.error('Meta CAPI accepted nothing', JSON.stringify(data)?.slice(0, 200));
  } catch (err) {
    console.error('Meta CAPI unreachable', (err as Error)?.message);
  }
  return false;
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

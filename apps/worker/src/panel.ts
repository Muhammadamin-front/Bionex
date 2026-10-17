import panelHtml from './panel/panel.html';
import type { LeadOutcome } from './telegram';
import { callTelegram, escapeHtml, outcomeKeyboard, STATUS_MARK, takeKeyboard, type TelegramConfig } from './telegram';

/**
 * The operators' Mini App: all orders, daily numbers, sold / not sold, spam.
 *
 * Opened from the "📊 Панелни очиш" button in the operators' group. Every API call carries the
 * Mini App's signed initData; the Worker checks Telegram's signature (so nobody can pretend to
 * be someone else) and that the person is a member of the operators' group (TELEGRAM_CHAT_ID).
 * Anyone else gets nothing — the page itself holds no data.
 */

const MAX_AGE_SECONDS = 24 * 3600;
const ACTIONS = new Set(['take', 'release', 'sold', 'noanswer', 'rejected', 'spam']);

export interface PanelUser {
  id: number;
  name: string;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
}

/** Telegram's Mini App check: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app */
export async function verifyInitData(initData: string, botToken: string, nowSeconds: number): Promise<PanelUser | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  const pairs: string[] = [];
  for (const [k, v] of params) if (k !== 'hash') pairs.push(`${k}=${v}`);
  pairs.sort();
  const secret = await hmac(new TextEncoder().encode('WebAppData'), botToken);
  const expected = hex(await hmac(secret, pairs.join('\n')));
  if (expected.length !== hash.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ hash.charCodeAt(i);
  if (diff !== 0) return null;
  const authDate = Number(params.get('auth_date'));
  if (!authDate || nowSeconds - authDate > MAX_AGE_SECONDS) return null;
  try {
    const user = JSON.parse(params.get('user') ?? 'null') as { id?: number; first_name?: string; last_name?: string } | null;
    if (!user?.id) return null;
    return { id: user.id, name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Оператор' };
  } catch {
    return null;
  }
}

/** Membership of the operators' group, remembered for 5 minutes per Worker instance. */
const members = new Map<number, { ok: boolean; until: number }>();

async function isGroupMember(cfg: TelegramConfig, userId: number): Promise<boolean> {
  const cached = members.get(userId);
  if (cached && cached.until > Date.now()) return cached.ok;
  let ok = false;
  try {
    const m = await callTelegram<{ status: string; is_member?: boolean }>(cfg, 'getChatMember', { chat_id: cfg.chatId, user_id: userId });
    ok = ['creator', 'administrator', 'member'].includes(m.status) || (m.status === 'restricted' && m.is_member === true);
  } catch {
    ok = false;
  }
  members.set(userId, { ok, until: Date.now() + 5 * 60_000 });
  return ok;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });

/** GET /panel — the Mini App page. Its own CSP: a per-request nonce, and Telegram may frame it. */
export function panelPage(): Response {
  const nonce = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  return new Response(panelHtml.replaceAll('{{NONCE}}', nonce), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
      'content-security-policy': [
        "default-src 'none'",
        `script-src 'nonce-${nonce}'`,
        "style-src 'unsafe-inline'",
        "connect-src 'self'",
        "img-src 'self' data:",
        "base-uri 'none'",
        "form-action 'none'",
        // Telegram Web and Desktop show Mini Apps in a frame.
        'frame-ancestors https://web.telegram.org https://*.telegram.org',
      ].join('; '),
    },
  });
}

/** /api/panel/* — data and actions for group members only. */
export async function panelApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return json(503, { error: 'not_configured' });
  const cfg: TelegramConfig = { token: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_CHAT_ID, apiBase: env.TELEGRAM_API_BASE || undefined };
  const auth = request.headers.get('authorization') ?? '';
  const user = auth.startsWith('tma ') ? await verifyInitData(auth.slice(4), env.TELEGRAM_BOT_TOKEN, Math.floor(Date.now() / 1000)) : null;
  if (!user) return json(401, { error: 'unauthorized', message: 'Панелни Telegram ичида, гуруҳдаги тугма орқали очинг.' });
  if (!(await isGroupMember(cfg, user.id))) {
    return json(403, { error: 'forbidden', message: 'Бу панел фақат «Bionex Leads» гуруҳи аъзолари учун.' });
  }
  const registry = env.REGISTRY.get(env.REGISTRY.idFromName('main'));

  if (url.pathname === '/api/panel/data' && request.method === 'GET') {
    const days = Number(url.searchParams.get('days') ?? 1) || 1;
    const data = await registry.panelData({ days, now: Date.now() });
    return json(200, { me: user, ...data });
  }

  if (url.pathname === '/api/panel/action' && request.method === 'POST') {
    // A panel action is a state change: only from this site's own page.
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return json(403, { error: 'forbidden' });
    const body = (await request.json().catch(() => null)) as { leadId?: unknown; action?: unknown } | null;
    const leadId = Number(body?.leadId);
    const action = String(body?.action ?? '');
    if (!Number.isInteger(leadId) || leadId < 1 || !ACTIONS.has(action)) return json(400, { error: 'bad_request' });
    const result = await registry.button({ leadId, action: action as 'take' | 'release' | LeadOutcome, userId: user.id, userName: user.name, now: Date.now() });
    if (result.changed && result.messageId && result.html) {
      // Keep the group message in step with the panel.
      try {
        await callTelegram(cfg, 'editMessageText', {
          chat_id: cfg.chatId,
          message_id: result.messageId,
          text: result.line ? `${result.html}${STATUS_MARK}${escapeHtml(result.line)}` : result.html,
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          reply_markup: result.keyboard === 'take' ? takeKeyboard(leadId) : outcomeKeyboard(leadId),
        });
      } catch (err) {
        console.error('Panel: could not update the group message', (err as Error)?.message);
      }
    }
    return json(200, { changed: result.changed, message: result.toast });
  }

  return json(404, { error: 'not_found' });
}

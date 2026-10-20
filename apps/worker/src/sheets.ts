import type { SiteId } from './sites';

/**
 * The partner's Google Sheet: where the partner site's orders go — and the only place they go
 * (see registry.ts `acceptPartner`). The partner's own people ring the customers from it, so
 * a row carries the full name and the phone number.
 *
 * The sheet is written by a small Apps Script web app in it (docs/PARTNER-SITE.md has the
 * script). It knows nothing about the columns: each send names its tab, the header row and
 * the row. «Holat» (the partner's own dropdown, copied onto each new row) and «Izoh» are left
 * for the partner's people. Every few minutes the Worker reads «Holat» back (`readSheetStatuses`)
 * and treats it like the operators' buttons (`sheetVerdict`). Reading it needs nothing the
 * script was not already allowed to do — no trigger, no extra Google permission.
 *
 * One send per order, best effort: a failure is logged and the order is still answered
 * "accepted" — it was recorded, and the customer must not be asked to order twice.
 */

export interface SheetsConfig {
  url: string;
  secret: string;
}

export interface SheetOrder {
  /** The partner's own running number (1, 2, 3 …). */
  number: number;
  at: number;
  fullName: string;
  /** E.164. */
  phone: string;
  campaign: string | null;
  adset: string | null;
  ad: string | null;
  flags: string[];
}

const SHEET = 'Lidlar';
const HEADERS = ['№', 'Sana', 'Ism', 'Telefon', 'Kampaniya', 'Ad set', 'Video', 'Belgi', 'Holat', 'Izoh'];

/** The same warnings the operators' group shows, for the people ringing from the sheet. */
const FLAG_TEXT: Record<string, string> = {
  honeypot: "bot bo'lishi mumkin",
  phone_pattern: "raqam soxtaga o'xshaydi",
  no_captcha: "«bot emasman» tekshiruvi o'tmadi",
  spam_source: 'bu tarmoqdan avval spam belgilangan',
  spam_device: 'bu qurilmadan avval spam belgilangan',
};

/**
 * What a «Holat» value means, read like the operators' buttons on the main site: 'spam' (the
 * partner's 🚫 Спам — never reported to Meta), 'real' (someone answered: their Lead goes to
 * Meta), or 'wait' (not rung yet, no answer, ring back — anything else). The dropdown is theirs,
 * so the words are recognised whatever their case or script.
 */
export type SheetVerdict = 'spam' | 'real' | 'wait';
export function sheetVerdict(status: unknown): SheetVerdict {
  const s = String(status ?? '');
  if (/keraksiz|кераксиз|spam|спам/i.test(s)) return 'spam';
  if (/kerakli|керакли|sotildi|сотилди|rad etdi|рад этди/i.test(s)) return 'real';
  return 'wait';
}

export function sheetsConfig(env: Env, site: SiteId): SheetsConfig | null {
  if (site !== 't2' || !env.SHEETS_T2_URL || !env.SHEETS_T2_SECRET) return null;
  return { url: env.SHEETS_T2_URL, secret: env.SHEETS_T2_SECRET };
}

const tashkentTime = (ms: number) =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));

/**
 * Sheets reads a cell starting with = + - @ as a formula (and "+998…" as a number): the
 * apostrophe keeps it text and does not show.
 */
const asText = (value: string) => (/^[=+\-@]/.test(value) ? `'${value}` : value);

/** Each order's number and what its «Holat» says; null when the sheet could not be read. */
export async function readSheetStatuses(cfg: SheetsConfig): Promise<Array<{ number: number; verdict: SheetVerdict }> | null> {
  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: cfg.secret, action: 'statuses', sheet: SHEET }),
      signal: AbortSignal.timeout(20_000),
    });
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) return null;
    return rows
      .filter((r): r is [unknown, unknown] => Array.isArray(r) && Number.isInteger(Number(r[0])) && Number(r[0]) > 0)
      .map(([number, status]) => ({ number: Number(number), verdict: sheetVerdict(status) }));
  } catch (err) {
    console.error('Google Sheets statuses unreadable', (err as Error)?.message);
    return null;
  }
}

export async function sendSheetOrder(cfg: SheetsConfig, order: SheetOrder): Promise<void> {
  const row = [
    order.number,
    tashkentTime(order.at),
    asText(order.fullName),
    asText(order.phone.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, '+998 $1 $2 $3 $4')),
    asText(order.campaign ?? ''),
    asText(order.adset ?? ''),
    asText(order.ad ?? ''),
    order.flags.map((f) => FLAG_TEXT[f]).filter(Boolean).join('; '),
    '',
    '',
  ];
  try {
    // Apps Script answers a POST with a redirect to its output; following it is how "ok" is read.
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: cfg.secret, sheet: SHEET, headers: HEADERS, row }),
      signal: AbortSignal.timeout(10_000),
    });
    const text = (await res.text()).trim();
    if (!res.ok || text !== 'ok') console.error(`Google Sheets refused order ${order.number} (${res.status} ${text.slice(0, 40)})`);
  } catch (err) {
    console.error('Google Sheets unreachable', (err as Error)?.message);
  }
}

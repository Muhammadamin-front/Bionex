import type { SiteId } from './sites';

/**
 * The partner's Google Sheet: where the partner site's orders go — and the only place they go
 * (see registry.ts `acceptPartner`). The partner's own people ring the customers from it, so
 * a row carries the full name and the phone number.
 *
 * The sheet is written by a small Apps Script web app in it (docs/PARTNER-SITE.md has the
 * script). It knows nothing about the columns: each send names its tab, the header row and
 * the row. «Holat» (the partner's own dropdown, copied onto each new row) and «Izoh» are left
 * for the partner's people. Every few minutes the Worker reads «Holat» back (`readSheetStatuses`):
 * «Keraksiz» there is the partner's 🚫 Спам. Reading it needs nothing the script was not already
 * allowed to do — no trigger, no extra Google permission.
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
  /** The phone's model as its browser names it. */
  model?: string;
  details?: string;
}

const SHEET = 'Lidlar';
/** The main spreadsheet's second tab: suspect orders (registry.ts MAIN_SPAM_SHEET_FLAGS) live here, never in «Lidlar». The script makes the tab on first use. */
export const SPAM_SHEET = 'Spam';
const HEADERS = ['№', 'Sana', 'Ism', 'Telefon', 'Kampaniya', 'Ad set', 'Video', 'Belgi', 'Holat', 'Izoh', 'Qurilma', 'Tafsilot'];

/** The same warnings the operators' group shows, for the people ringing from the sheet. */
const FLAG_TEXT: Record<string, string> = {
  honeypot: "bot bo'lishi mumkin",
  bot_trap: "bot tuzog'iga tushdi",
  multi_phone_ip: 'bu tarmoqdan bugun bir nechta raqam yuborildi',
  no_browser: "bot: sahifa ochilmasdan to'g'ridan-to'g'ri yuborilgan",
  synthetic_click: "sahifada dastur bosishi sezildi, lekin boshqa bot belgisi yo'q (Instagram brauzeri bo'lishi mumkin, odam ham bo'lishi mumkin)",
  decoy_filled: "yashirin maydon to'ldirilgan, lekin dastur belgisi yo'q (avto-to'ldirish bo'lishi mumkin, odam ham bo'lishi mumkin)",
  phone_autofill: "raqam avtomatik to'ldirilgan (Instagram/telefon) — eski, ishlamaydigan raqam bo'lishi mumkin",
  phone_pattern: "raqam soxtaga o'xshaydi",
  reused_click: "shu reklama bosilishi avval boshqa raqamdan ishlatilgan (havola ko'chirilgan bo'lishi mumkin)",
  no_captcha: "«bot emasman» tekshiruvi o'tmadi",
  likely_bot: "Instagram/Facebook'dan emas — bot ehtimoli bor (odam ham bo'lishi mumkin)",
  spam_source: 'bu tarmoqdan avval spam belgilangan',
  spam_device: 'bu qurilmadan avval spam belgilangan',
  spam_lookalike: "avval spam bo'lgan qurilmaga o'xshaydi",
};

/**
 * Whether a «Holat» value means "a fake order": the partner's 🚫 Спам. The dropdown is theirs,
 * so «Keraksiz» and «Spam» are recognised whatever their case or script.
 */
export const isSpamStatus = (status: unknown) => /keraksiz|кераксиз|spam|спам/i.test(String(status ?? ''));

/**
 * What a «Holat» in the main site's sheet means for Meta (the owner's rules, 2026-10-26):
 * «Sotildi» a sale (Lead + Purchase), «Kerakli» a real person (Lead), «Keraksiz» spam (no Lead,
 * remembered). Anything else — «Ko'tarmadi», «Qaytib qo'ng'iroq», empty — waits (null).
 * «Kerakli» rides as `rejected`: the outcome that reports a Lead and no Purchase.
 */
export function sheetOutcome(status: unknown): 'sold' | 'rejected' | 'spam' | null {
  const s = String(status ?? '').trim();
  if (isSpamStatus(s)) return 'spam';
  if (/sotildi|сотилди/i.test(s)) return 'sold';
  if (/^(kerakli|керакли)\b/i.test(s)) return 'rejected';
  return null;
}

export function sheetsConfig(env: Env, site: SiteId): SheetsConfig | null {
  // The main site's own sheet («Bionex-Zeynara»): a copy of each order next to the operators'
  // Telegram group, which stays where the work is done. Off until both values are set.
  if (site === 'main') return env.SHEETS_URL && env.SHEETS_SECRET ? { url: env.SHEETS_URL, secret: env.SHEETS_SECRET } : null;
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

/** Each order's number and its «Holat» (as written, and whether it says spam); null when the sheet could not be read. */
export async function readSheetStatuses(cfg: SheetsConfig): Promise<Array<{ number: number; spam: boolean; status: string }> | null> {
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
      .map(([number, status]) => ({ number: Number(number), spam: isSpamStatus(status), status: String(status ?? '') }));
  } catch (err) {
    console.error('Google Sheets statuses unreadable', (err as Error)?.message);
    return null;
  }
}

/** Appends the order to `tab`; true only when the sheet answered «ok». */
/**
 * Sets one cell of an order's row (by its №, in «Lidlar» or «Spam»), the header made if missing —
 * the `note` action of the main sheet's script (docs/main-sheet-script.js). An order's row is added a
 * moment after it arrives, so a «not found» is tried once more a few seconds later.
 */
export async function sendSheetNote(cfg: SheetsConfig, note: { number: number; column: string; value: string }): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret: cfg.secret, action: 'note', ...note }),
        signal: AbortSignal.timeout(10_000),
      });
      const text = (await res.text()).trim();
      if (res.ok && text === 'ok') return true;
      if (text !== 'notfound') {
        console.error(`Google Sheets refused the note for order ${note.number} (${res.status} ${text.slice(0, 40)})`);
        return false;
      }
    } catch (err) {
      console.error('Google Sheets unreachable', (err as Error)?.message);
      return false;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return false;
}

export async function sendSheetOrder(cfg: SheetsConfig, order: SheetOrder, tab: string = SHEET): Promise<boolean> {
  const row = [
    order.number,
    tashkentTime(order.at),
    asText(order.fullName),
    asText(order.phone.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, '+998 $1 $2 $3 $4')),
    asText(order.campaign ?? ''),
    asText(order.adset ?? ''),
    asText(order.ad ?? ''),
    // «!» first when the "not a robot" check failed: worth a call, but listen for a robot.
    (order.flags.includes('no_captcha') ? '! ' : '') + order.flags.map((f) => FLAG_TEXT[f]).filter(Boolean).join('; '),
    '',
    '',
    asText(order.model ?? ''),
    asText(order.details ?? ''),
  ];
  try {
    // Apps Script answers a POST with a redirect to its output; following it is how "ok" is read.
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: cfg.secret, sheet: tab, headers: HEADERS, row }),
      signal: AbortSignal.timeout(10_000),
    });
    const text = (await res.text()).trim();
    if (res.ok && text === 'ok') return true;
    console.error(`Google Sheets refused order ${order.number} (${res.status} ${text.slice(0, 40)})`);
  } catch (err) {
    console.error('Google Sheets unreachable', (err as Error)?.message);
  }
  return false;
}

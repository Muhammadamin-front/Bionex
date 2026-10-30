import { formatUzPhone } from '@bionex/shared/phone';

/** What the operators need to call the customer back. */
export interface LeadMessage {
  /** Running order number, so operators can refer to "№37". */
  number: number;
  fullName: string;
  /** E.164: "+998901234567". */
  phone: string;
  createdAt: number;
  utm: Record<string, string | undefined>;
  /** Short pseudonymous id of the visitor's network, and how many numbers it sent today. */
  source: { id: string; phonesToday: number };
  flags: string[];
  /** The phone's model as its browser names it ("SM-A135F · Android 13"). */
  model?: string;
  /** The browser's signals in one line: GPU, touch, how the form was filled… */
  details?: string;
  /** Where this order stands in the next list, e.g. 3 of 10 (absent when lists are off). */
  list?: { count: number; size: number };
  /** Ordered through the Telegram bot: the number was shared as a contact (verified) or typed. */
  via?: 'bot-contact' | 'bot-typed';
}

/** Numeric ad ids ("120253199231260134") name nothing an operator can act on. */
const isAdId = (value: string | undefined): boolean => !value || /^\d{6,}$/.test(value);

/** Campaign names run long; the operator only needs enough of one to tell two ads apart. */
const shorten = (value: string, max = 42): string => (value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`);

const KNOWN_SOURCES: Record<string, string> = {
  ig: 'Instagram',
  instagram: 'Instagram',
  fb: 'Facebook',
  facebook: 'Facebook',
  tg: 'Telegram',
  telegram: 'Telegram',
  google: 'Google',
  youtube: 'YouTube',
};

export interface UtmParts {
  platform: string | null;
  campaign: string | null;
  adset: string | null;
  ad: string | null;
}

/** Extracts separate platform, campaign, ad set (target), and video/ad names for the CRM table. */
export function utmParts(utm: Record<string, string | undefined>): UtmParts {
  const src = (utm.source ?? '').toLowerCase();
  const platform = KNOWN_SOURCES[src] ?? (utm.source || null);
  const campaign = !isAdId(utm.campaign) ? shorten(utm.campaign!, 80) : null;
  const ad = !isAdId(utm.content) ? shorten(utm.content!, 80) : null;
  const adset = !isAdId(utm.term) ? shorten(utm.term!, 80) : null;
  return { platform, campaign, adset, ad };
}

/**
 * Where the visitor came from, in words an operator understands (ad ids are left out).
 *
 * Campaign, then ad set, then ad — because with two campaigns running at once the operator
 * has to know which one produced the call, and a report that says only "Facebook" cannot
 * tell them apart. Repeats are dropped: a campaign duplicated from another keeps the
 * original's ad set and ad names, so those three fields are often the same string twice.
 */
export function sourceLabel(utm: Record<string, string | undefined>): string | null {
  const src = (utm.source ?? '').toLowerCase();
  const name = KNOWN_SOURCES[src] ?? (utm.source || null);
  if (!name) return null;
  const parts: string[] = [];
  for (const value of [utm.campaign, utm.term, utm.content]) {
    if (isAdId(value)) continue;
    const text = shorten(value!);
    if (!parts.includes(text)) parts.push(text);
  }
  return [name, ...parts].join(' · ');
}

export interface TelegramConfig {
  token: string;
  chatId: string;
  /** Overridable for tests. */
  apiBase?: string;
}

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const tashkentTime = (ms: number) =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));

const FLAG_TEXT: Record<string, string> = {
  honeypot: 'бот бўлиши мумкин (яширин майдон тўлдирилган)',
  bot_trap: 'бот тузоғига тушди (экранга тегилмаган, дастур босган ёки дастур бошқарган)',
  no_browser: 'бот: саҳифа очилмасдан тўғридан-тўғри юборилган',
  synthetic_click: 'саҳифада дастур босиши сезилди, лекин бошқа бот белгиси йўқ (Instagram браузери бўлиши мумкин, одам ҳам бўлиши мумкин)',
  decoy_filled: 'яширин майдон тўлдирилган, лекин дастур белгиси йўқ (автотўлдириш бўлиши мумкин, одам ҳам бўлиши мумкин)',
  phone_autofill: 'рақам автоматик тўлдирилган (Instagram/телефон) — эски, ишламайдиган рақам бўлиши мумкин',
  phone_pattern: 'рақам сунъийга ўхшайди (масалан 90 111 11 11)',
  multi_phone_ip: 'бу манбадан бугун бир нечта рақам юборилди',
  spam_source: 'бу манбадан аввал спам белгиланган',
  spam_device: 'бу қурилмадан аввал спам белгиланган (тармоғини алмаштирган бўлса ҳам)',
  spam_lookalike: 'аввал спам бўлган қурилмага ўхшайди (браузерини тозалаган бўлиши мумкин)',
  reused_click: 'шу реклама босилиши аввал бошқа рақамдан ишлатилган (ҳавола кўчирилган бўлиши мумкин)',
  no_captcha: '«бот эмасман» текшируви ўтмади (бот ёки эски телефон бўлиши мумкин)',
  likely_bot: 'Instagram/Facebook орқали эмас — бот эҳтимоли бор (одам ҳам бўлиши мумкин)',
};

/** The flags an order's group message carried, read back from its saved text (for orders from before the flags were kept apart). */
export function flagsInMessage(html: string): string[] {
  return Object.entries(FLAG_TEXT)
    .filter(([, text]) => html.includes(text))
    .map(([flag]) => flag);
}

export function formatLead(lead: LeadMessage): string {
  const lines = [
    `🆕 <b>Янги буюртма №${lead.number}</b>`,
    `👤 ${escapeHtml(lead.fullName)}`,
    // Plain text on purpose: Telegram makes it a phone link — one tap offers "Call" and "Copy".
    `📞 ${formatUzPhone(lead.phone)}`,
    `🕒 ${tashkentTime(lead.createdAt)}`,
  ];
  if (lead.via) {
    lines.push(lead.via === 'bot-contact' ? '🤖 Telegram бот орқали · рақам тасдиқланган ✅' : '🤖 Telegram бот орқали · рақам қўлда ёзилган');
  } else {
    const source = sourceLabel(lead.utm);
    if (source) lines.push(`📣 ${escapeHtml(source)}`);
  }
  if (lead.model) lines.push(`📱 ${escapeHtml(lead.model)}`);
  if (lead.details) lines.push(`🔬 ${escapeHtml(lead.details)}`);
  // The source line matters only when something looks off; otherwise it is noise.
  if (lead.source.phonesToday > 1 || lead.flags.length > 0) {
    const sourceNote = lead.source.phonesToday > 1 ? ` (бугун ${lead.source.phonesToday} та рақам)` : '';
    lines.push(`🔎 Манба #${lead.source.id}${sourceNote}`);
  }
  if (lead.flags.length > 0) {
    lines.push('', `⚠️ <b>Текширинг:</b> ${lead.flags.map((f) => FLAG_TEXT[f] ?? f).join('; ')}`);
  }
  if (lead.list) lines.push('', formatListStatus(lead.list.count, lead.list.size));
  return lines.join('\n');
}

/** The bot's running status under every order, so the group can see it is alive and counting. */
export function formatListStatus(count: number, size: number): string {
  if (count >= size) return `📋 ${size} та бўлди — рўйхат «📊 Ҳисобот»га юборилди. Бугунгилар: /royxat`;
  if (count === 0) return '📋 Янги рўйхат учун ҳозир буюртма йўқ. Бугунгилар: /royxat';
  return `📋 Рўйхатда ${count} та. Яна ${size - count} та келса, рўйхатни юбораман. Бугунгилар: /royxat`;
}

export function formatStatus(s: { listCount: number; listSize: number; today: number; lastLeadAt: number | null; queued: number }): string {
  return [
    '✅ <b>Бот ишлаяпти.</b>',
    s.listSize > 0 ? formatListStatus(s.listCount, s.listSize) : '📋 Рўйхатлар ўчирилган.',
    `📅 Бугун: ${s.today} та янги буюртма.`,
    `🕒 Охирги буюртма: ${s.lastLeadAt ? tashkentTime(s.lastLeadAt) : 'ҳали йўқ'}`,
    s.queued > 0 ? `⚠️ Telegram'га етказилмай турган хабарлар: ${s.queued} (ўзи қайта юборилади).` : '📨 Барча хабарлар етказилган.',
  ].join('\n');
}

export const HELP_TEXT = [
  '🤖 <b>Буйруқлар</b>',
  '/royxat — бугунги барча буюртмалар: ким олди, натижаси',
  '/holat — бот ишлаяптими, рўйхатда нечта буюртма бор',
  '/hisobot — бугунги ҳисобот (ҳар куни 20:00 да ўзи ҳам келади)',
  '/panel — операторлар панели: барча буюртмалар, статистика, спам',
  '/spam 3 — охирги 3 кундаги спам ва текширувдан ўтмаган буюртмаларни Google жадвалдаги «Spam» варағига кўчириш («/spam 3 qayta» — қайтадан ёзиш)',
  '',
  'Ҳар буюртма остида: «📞 Мен оламан» → қўнғироқдан кейин «✅ Сотилди», «❌ Рад этди», «🔁 Кўтармади» ёки «⏰ Кейинроқ».',
  '⏰ Кейинроқ — мижоз гаплашди, лекин «ҳозир вақтим йўқ» деди. Кейин қайта қўнғироқ қилиб, натижани белгилаб қўйинг.',
].join('\n');

// ── Buttons under every order ─────────────────────────────────────────────

/**
 * What the call came to. `callback` is the customer who answered and asked to be rung later
 * ("ҳозир вақтим йўқ") — a real person, but not yet a decision, so it is kept apart from
 * `noanswer` (nobody picked up) and from `rejected` (answered and said no).
 */
export type LeadOutcome = 'sold' | 'noanswer' | 'callback' | 'rejected' | 'spam';
export type InlineKeyboard = { inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> };

/** callback_data is at most 64 bytes: "t:37" take, "r:37" release, "s:37:sold" outcome. */
export function takeKeyboard(leadId: number): InlineKeyboard {
  return { inline_keyboard: [[{ text: '📞 Мен оламан', callback_data: `t:${leadId}` }]] };
}

/**
 * Two buttons per row: an operator presses these one-handed while still holding the phone,
 * and the pair that means "ring again" sits together so neither is hit by mistake.
 */
export function outcomeKeyboard(leadId: number): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '✅ Сотилди', callback_data: `s:${leadId}:sold` },
        { text: '❌ Рад этди', callback_data: `s:${leadId}:rejected` },
      ],
      [
        { text: '🔁 Кўтармади', callback_data: `s:${leadId}:noanswer` },
        { text: '⏰ Кейинроқ', callback_data: `s:${leadId}:callback` },
      ],
      [
        { text: '↩️ Қайтариш', callback_data: `r:${leadId}` },
        { text: '🚫 Спам', callback_data: `s:${leadId}:spam` },
      ],
    ],
  };
}

export const OUTCOME_TEXT: Record<LeadOutcome, string> = {
  sold: '✅ Сотилди',
  noanswer: '🔁 Кўтармади',
  callback: '⏰ Кейинроқ сўради',
  rejected: '❌ Рад этди',
  spam: '🚫 Спам',
};

/** A link button that opens the operators' Mini App (web_app buttons are not allowed in groups). */
export function panelKeyboard(url: string): InlineKeyboard {
  return { inline_keyboard: [[{ text: '📊 Панелни очиш', url }]] };
}

/** The line the bot adds under an order once an operator has it. */
export function operatorLine(s: { takerName: string; takenAt: number; outcome: LeadOutcome | null; outcomeAt: number | null }): string {
  if (s.outcome && s.outcomeAt) return `${OUTCOME_TEXT[s.outcome]} — ${s.takerName}, ${tashkentTime(s.outcomeAt)}`;
  return `📞 ${s.takerName} олди — ${tashkentTime(s.takenAt)}`;
}

/** Everything after this marker in an order message is the operator's status, rewritten on each press. */
export const STATUS_MARK = '\n\n━━━━━━━━━━\n';

export interface DayReport {
  date: number;
  total: number;
  sold: number;
  noanswer: number;
  callback: number;
  rejected: number;
  spam: number;
  inProgress: number;
  untaken: number;
  repeats: number;
  /** Orders, of any day, still without an outcome — so Meta has not been told about them. */
  unreported: number;
  /** Order attempts refused by a limit today, by reason (registry.ts `refused`). */
  refused?: Record<string, number>;
  operators: Array<{ name: string; taken: number; sold: number }>;
}

/**
 * Orders still without an outcome. Meta is told about an order only once an operator has
 * pressed one, so every unpressed button is an ad that keeps looking for the wrong people —
 * worth a line in the report, in the words that say why it matters.
 */
const unreportedLine = (n: number) => `📣 Натижаси белгиланмаган: ${n} та — буларни реклама ҳисобга олмайди.`;

const REFUSAL_TEXT: Record<string, string> = {
  device: 'битта телефондан соатига кўп уриниш',
  device_numbers: 'битта телефондан кунига кўп рақам',
  network: 'битта тармоқдан жуда кўп уриниш',
  network_numbers: 'битта тармоқдан жуда кўп рақам',
  phone: 'битта рақамга соатига кўп уриниш',
};

/** «🚧 Лимит сабабли қабул қилинмади: 4 та (…)» — or nothing when no attempt was refused. */
function refusedLine(refused: Record<string, number> | undefined): string | null {
  const parts = Object.entries(refused ?? {}).filter(([, n]) => n > 0);
  if (!parts.length) return null;
  const total = parts.reduce((s, [, n]) => s + n, 0);
  return `🚧 Лимит сабабли қабул қилинмади: ${total} та (${parts.map(([k, n]) => `${REFUSAL_TEXT[k] ?? k} — ${n}`).join('; ')})`;
}

export function formatReport(r: DayReport): string {
  const day = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit' }).format(new Date(r.date));
  const refused = refusedLine(r.refused);
  if (r.total === 0) {
    const idle = `📊 <b>Ҳисобот (${day})</b>\nБугун янги буюртма бўлмади. Бот ишлаяпти ✅`;
    return [idle, ...(r.unreported > 0 ? [unreportedLine(r.unreported)] : []), ...(refused ? [refused] : [])].join('\n');
  }
  const lines = [
    `📊 <b>Ҳисобот (${day})</b>`,
    `🆕 Янги буюртмалар: ${r.total}`,
    `✅ Сотилди: ${r.sold}`,
    `❌ Рад этди: ${r.rejected}`,
    `🔁 Кўтармади: ${r.noanswer}`,
    ...(r.callback > 0 ? [`⏰ Кейинроқ сўради: ${r.callback} — қайта қўнғироқ қилиш керак.`] : []),
    ...(r.spam > 0 ? [`🚫 Спам: ${r.spam}`] : []),
    `📞 Олинган, натижа йўқ: ${r.inProgress}`,
    `⏳ Ҳеч ким олмаган: ${r.untaken}`,
  ];
  if (r.repeats > 0) lines.push(`🔁 Такрор юборганлар: ${r.repeats}`);
  if (r.unreported > 0) lines.push(unreportedLine(r.unreported));
  if (refused) lines.push(refused);
  if (r.operators.length > 0) {
    lines.push('', '<b>Операторлар:</b>', ...r.operators.map((o) => `• ${escapeHtml(o.name)} — ${o.taken} та олди, ${o.sold} та сотди`));
  }
  return lines.join('\n');
}

/** The secret Telegram sends with every webhook call; derived from the bot token, so nothing extra to configure. */
export async function webhookSecret(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`zeynara-webhook:${token}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Calls any Bot API method and returns its `result` (throws if Telegram says not ok). */
export async function callTelegram<T = unknown>(cfg: TelegramConfig, method: string, body: unknown): Promise<T> {
  const res = await fetch(`${cfg.apiBase ?? 'https://api.telegram.org'}/bot${cfg.token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
  if (!data?.ok) throw new TelegramError(`Telegram ${method}: ${data?.description ?? res.status}`, false);
  return data.result as T;
}

export interface ListItem {
  number: number;
  fullName: string;
  phone: string;
  createdAt: number;
  flagged: boolean;
  takerName?: string | null;
  outcome?: LeadOutcome | null;
}

const clock = (ms: number) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

const ITEMS_PER_MESSAGE = 25;

/**
 * Orders as a list for operators to share out. Each order takes two lines and the phone
 * stands alone on the second one: next to a date, Telegram would read "…37 00 — 17.10" as
 * one number, and copying it would copy the date too.
 */
export function formatList(title: string, items: ListItem[]): string[] {
  const entry = (i: ListItem) => {
    const state = !i.takerName
      ? '⏳ олинмаган'
      : i.outcome
        ? `${OUTCOME_TEXT[i.outcome]} (${escapeHtml(i.takerName)})`
        : `📞 ${escapeHtml(i.takerName)}`;
    return `<b>${i.number}.</b> ${escapeHtml(i.fullName)} · ${clock(i.createdAt)} · ${state}${i.flagged ? ' ⚠️' : ''}\n📞 ${formatUzPhone(i.phone)}`;
  };
  const messages: string[] = [];
  for (let start = 0; start < items.length; start += ITEMS_PER_MESSAGE) {
    const part = items.slice(start, start + ITEMS_PER_MESSAGE).map(entry).join('\n\n');
    messages.push(start === 0 ? `${title}\n\n${part}` : `📋 (давоми)\n\n${part}`);
  }
  return messages;
}

export function batchTitle(items: ListItem[]): string {
  return `📋 <b>Рўйхат: №${items[0]!.number}–№${items[items.length - 1]!.number}</b> (${items.length} та буюртма)`;
}

export function todayTitle(now: number, items: ListItem[]): string {
  const day = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit' }).format(new Date(now));
  const n = (f: (i: ListItem) => boolean) => items.filter(f).length;
  return [
    `📋 <b>Бугунги буюртмалар (${day})</b> — ${items.length} та`,
    `⏳ Олинмаган: ${n((i) => !i.takerName)} · 📞 Жараёнда: ${n((i) => Boolean(i.takerName) && !i.outcome)} · ✅ Сотилди: ${n((i) => i.outcome === 'sold')}`,
  ].join('\n');
}

export function formatRepeat(phone: string, count: number, at: number): string {
  return `🔁 Мижоз яна буюртма юборди (${count}-марта): ${formatUzPhone(phone)} — ${tashkentTime(at)}. Тезроқ қўнғироқ қилинг.`;
}

export class TelegramError extends Error {
  constructor(
    message: string,
    /** True when retrying cannot help (wrong token, bot not in the group). */
    readonly permanent: boolean,
  ) {
    super(message);
  }
}

/** Sends a message to the operators' group and returns its id (used to reply to it later). */
export async function sendTelegram(
  cfg: TelegramConfig,
  text: string,
  replyTo?: number,
  replyMarkup?: InlineKeyboard,
  threadId?: number,
): Promise<number> {
  const url = `${cfg.apiBase ?? 'https://api.telegram.org'}/bot${cfg.token}/sendMessage`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        ...(replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}),
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        ...(threadId ? { message_thread_id: threadId } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new TelegramError('Telegram unreachable', false);
  }
  const body = (await res.json().catch(() => null)) as { ok?: boolean; result?: { message_id?: number }; description?: string } | null;
  if (res.ok && body?.ok && body.result?.message_id) return body.result.message_id;
  // 400/401/403/404: wrong token or chat id, bot removed from the group — needs a person.
  const permanent = [400, 401, 403, 404].includes(res.status);
  throw new TelegramError(`Telegram ${res.status}: ${body?.description ?? 'no description'}`, permanent);
}

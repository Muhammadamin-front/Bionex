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
  /** Where this order stands in the next list, e.g. 3 of 10 (absent when lists are off). */
  list?: { count: number; size: number };
  /** Ordered through the Telegram bot: the number was shared as a contact (verified) or typed. */
  via?: 'bot-contact' | 'bot-typed';
}

/** Where the visitor came from, in words an operator understands (ad ids are left out). */
export function sourceLabel(utm: Record<string, string | undefined>): string | null {
  const src = (utm.source ?? '').toLowerCase();
  const known: Record<string, string> = {
    ig: 'Instagram',
    instagram: 'Instagram',
    fb: 'Facebook',
    facebook: 'Facebook',
    tg: 'Telegram',
    telegram: 'Telegram',
    google: 'Google',
    youtube: 'YouTube',
  };
  const name = known[src] ?? (utm.source || null);
  if (!name) return null;
  // Campaign names help; numeric ad ids ("120253199231260134") only clutter the message.
  const campaign = utm.campaign && !/^\d{6,}$/.test(utm.campaign) ? utm.campaign : null;
  return campaign ? `${name} · ${campaign}` : name;
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
  phone_pattern: 'рақам сунъийга ўхшайди (масалан 90 111 11 11)',
  multi_phone_ip: 'бу манбадан бугун бир нечта рақам юборилди',
  spam_source: 'бу манбадан аввал спам белгиланган',
  no_captcha: '«бот эмасман» текшируви ўтмади (бот ёки эски телефон бўлиши мумкин)',
};

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
  '',
  'Ҳар буюртма остида: «📞 Мен оламан» → қўнғироқдан кейин «✅ Сотилди», «🔁 Кўтармади» ёки «❌ Рад этди».',
].join('\n');

// ── Buttons under every order ─────────────────────────────────────────────

export type LeadOutcome = 'sold' | 'noanswer' | 'rejected' | 'spam';
export type InlineKeyboard = { inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> };

/** callback_data is at most 64 bytes: "t:37" take, "r:37" release, "s:37:sold" outcome. */
export function takeKeyboard(leadId: number): InlineKeyboard {
  return { inline_keyboard: [[{ text: '📞 Мен оламан', callback_data: `t:${leadId}` }]] };
}

export function outcomeKeyboard(leadId: number): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '✅ Сотилди', callback_data: `s:${leadId}:sold` },
        { text: '🔁 Кўтармади', callback_data: `s:${leadId}:noanswer` },
        { text: '❌ Рад этди', callback_data: `s:${leadId}:rejected` },
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
  rejected: number;
  spam: number;
  inProgress: number;
  untaken: number;
  repeats: number;
  operators: Array<{ name: string; taken: number; sold: number }>;
}

export function formatReport(r: DayReport): string {
  const day = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit' }).format(new Date(r.date));
  if (r.total === 0) return `📊 <b>Ҳисобот (${day})</b>\nБугун янги буюртма бўлмади. Бот ишлаяпти ✅`;
  const lines = [
    `📊 <b>Ҳисобот (${day})</b>`,
    `🆕 Янги буюртмалар: ${r.total}`,
    `✅ Сотилди: ${r.sold}`,
    `🔁 Кўтармади: ${r.noanswer}`,
    `❌ Рад этди: ${r.rejected}`,
    ...(r.spam > 0 ? [`🚫 Спам: ${r.spam}`] : []),
    `📞 Олинган, натижа йўқ: ${r.inProgress}`,
    `⏳ Ҳеч ким олмаган: ${r.untaken}`,
  ];
  if (r.repeats > 0) lines.push(`🔁 Такрор юборганлар: ${r.repeats}`);
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

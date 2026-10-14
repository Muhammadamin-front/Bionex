import { formatUzPhone } from '@bionex/shared/phone';

/** What the operators need to call the customer back. */
export interface LeadMessage {
  fullName: string;
  /** E.164: "+998901234567". */
  phone: string;
  createdAt: number;
  utm: Record<string, string | undefined>;
  /** Short pseudonymous id of the visitor's network, and how many numbers it sent today. */
  source: { id: string; phonesToday: number };
  flags: string[];
}

export interface TelegramConfig {
  token: string;
  chatId: string;
  /** Overridable for tests. */
  apiBase?: string;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
};

export function formatLead(lead: LeadMessage): string {
  const lines = [
    '🆕 <b>Янги буюртма</b>',
    `👤 ${escapeHtml(lead.fullName)}`,
    `📞 ${formatUzPhone(lead.phone)}`,
    `🕒 ${tashkentTime(lead.createdAt)}`,
  ];
  const utm = [lead.utm.source, lead.utm.campaign, lead.utm.content].filter(Boolean).join(' / ');
  if (utm) lines.push(`📣 ${escapeHtml(utm)}`);
  const sourceNote = lead.source.phonesToday > 1 ? ` (бугун ${lead.source.phonesToday} та рақам)` : '';
  lines.push(`🔎 Манба #${lead.source.id}${sourceNote}`);
  if (lead.flags.length > 0) {
    lines.push('', `⚠️ <b>Текширинг:</b> ${lead.flags.map((f) => FLAG_TEXT[f] ?? f).join('; ')}`);
  }
  return lines.join('\n');
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
export async function sendTelegram(cfg: TelegramConfig, text: string, replyTo?: number): Promise<number> {
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

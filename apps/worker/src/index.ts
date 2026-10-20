import { HONEYPOT_FIELD, makeLeadSubmissionSchema, type ApiError, type ApiErrorCode, type LeadSubmitResponse } from '@bionex/shared/lead';
import { phoneLooksSynthetic } from '@bionex/shared/phone';
import { site } from '../../web/src/config/product';
import { buildUserData, metaConfig } from './meta';
import { WorkerEntrypoint } from 'cloudflare:workers';
import { isGroupMember, panelApi, panelPage, signWebToken } from './panel';
import { callTelegram, HELP_TEXT, outcomeKeyboard, panelKeyboard, STATUS_MARK, takeKeyboard, webhookSecret, type LeadOutcome } from './telegram';
import { readSheetStatuses, sheetsConfig } from './sheets';
import type { SiteId } from './sites';
import { CONFIG_ERRORS, TurnstileUnavailable, verifyTurnstile } from './turnstile';

export { LeadRegistry } from './registry';

/** "… or call +998 …" — only when the site shows a working number (site.phone). */
const OR_CALL = site.phone ? ` ёки ${site.phone} рақамига қўнғироқ қилинг` : '';

export const MESSAGES = {
  accepted: 'Раҳмат! Буюртмангиз қабул қилинди. Оператор тез орада сизга қўнғироқ қилади.',
  duplicate: 'Буюртмангиз аллақачон қабул қилинган. Оператор тез орада сизга қўнғироқ қилади.',
  validation: 'Илтимос, маълумотларни тўғри киритинг.',
  turnstile: `Хавфсизлик текширувидан ўтилмади. Саҳифани янгилаб, қайта уриниб кўринг${OR_CALL}.`,
  rateLimited: `Бу қурилмадан жуда кўп уриниш бўлди. Илтимос, бироздан сўнг қайта уриниб кўринг${OR_CALL}.`,
  ipDailyLimit: site.phone
    ? `Бу қурилмадан бугун жуда кўп буюртма юборилди. Илтимос, буюртма учун ${site.phone} рақамига қўнғироқ қилинг.`
    : 'Бу қурилмадан бугун жуда кўп буюртма юборилди. Илтимос, эртага қайта уриниб кўринг.',
  unavailable: `Буюртмани ҳозир қабул қилиб бўлмади. Илтимос, бироздан сўнг қайта уриниб кўринг${OR_CALL}.`,
  forbidden: 'Бу амал учун рухсат йўқ.',
  notFound: 'Топилмади.',
} as const;

const schema = makeLeadSubmissionSchema();
/** The cron (wrangler.jsonc) that reads the partner sheet's «Holat» column. */
const PARTNER_SHEET_CRON = '*/5 * * * *';
const MAX_BODY = 8 * 1024;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    },
  });

const fail = (status: number, code: ApiErrorCode, message: string, fields?: Record<string, string>) =>
  json(status, { error: { code, message, ...(fields ? { fields } : {}) } } satisfies ApiError);

const CONFIG_ALERT: Record<string, string> = {
  'invalid-input-secret': 'TURNSTILE_SECRET_KEY нотўғри',
  'test-sitekey-in-production': 'сайт Turnstile TEST калити билан йиғилган (VITE_TURNSTILE_SITE_KEY)',
  'hostname-mismatch': "сайт манзили Cloudflare Turnstile виджетининг Hostnames рўйхатида йўқ",
};

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    // The operators' Mini App & Table CRM (served by the Worker for its own CSP).
    if ((url.pathname === '/panel' || url.pathname === '/crm') && (request.method === 'GET' || request.method === 'HEAD')) return panelPage();
    if (url.pathname.startsWith('/api/panel/')) return panelApi(request, env, url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    if (url.pathname === '/api/telegram/hook' && request.method === 'POST') return telegramCommand(request, env, url.origin);

    if (url.pathname === '/api/health' && request.method === 'GET') {
      // For a quick check after deploying. Says only whether settings exist, never their values.
      const registry = env.REGISTRY.get(env.REGISTRY.idFromName('main'));
      ctx.waitUntil(registry.ensureWebhook(url.origin));
      const queued = await registry.queued();
      return json(200, {
        ok: true,
        turnstileSecret: Boolean(env.TURNSTILE_SECRET_KEY),
        telegram: env.TELEGRAM_DRY_RUN === '1' ? 'dry-run' : Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
        /** Whether orders are reported to Meta from here at all (both the pixel id and the token). */
        meta: Boolean(metaConfig(env)),
        /** Whether a sale also sends Purchase with a value; without it Meta sees the sale but no revenue. */
        metaOrderValue: Boolean(env.META_ORDER_VALUE),
        /** The partner site (sites.ts): its own Conversions API, and its Google Sheet. */
        partnerMeta: Boolean(metaConfig(env, 't2')),
        partnerSheet: Boolean(env.SHEETS_T2_URL && env.SHEETS_T2_SECRET),
        /** Orders waiting because Telegram did not accept them yet; they are retried automatically. */
        waitingForTelegram: queued,
      });
    }
    if (url.pathname !== '/api/leads') return fail(404, 'not_found', MESSAGES.notFound);
    if (request.method !== 'POST') return fail(405, 'not_found', MESSAGES.notFound);
    return takeOrder(request, env, ctx, url, 'main');
  },

  /**
   * Crons in wrangler.jsonc. Every few minutes: the partner sheet's «Keraksiz» marks. Every
   * evening: the day's report to the group, which also shows the bot is alive.
   */
  async scheduled(controller, env, ctx) {
    if (controller.cron === PARTNER_SHEET_CRON) {
      ctx.waitUntil(syncPartnerSheet(env, Date.now()));
      return;
    }
    if (env.TELEGRAM_DRY_RUN !== '1' && !(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID)) return;
    ctx.waitUntil(env.REGISTRY.get(env.REGISTRY.idFromName('main')).dailyReport(Date.now()));
  },
} satisfies ExportedHandler<Env>;

/**
 * A POST /api/leads, from this Worker's own site or from the partner site (`PartnerSite`).
 * `url` is the address the customer used, so the origin check and Turnstile's hostname check
 * hold for either site.
 */
async function takeOrder(request: Request, env: Env, ctx: ExecutionContext, url: URL, site: SiteId): Promise<Response> {
  // Cross-site form posts are refused; browsers always send Origin on POST.
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return fail(403, 'forbidden', MESSAGES.forbidden);

  const raw = await request.text();
  if (raw.length > MAX_BODY) return fail(413, 'validation_failed', MESSAGES.validation);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, 'validation_failed', MESSAGES.validation);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if ((key === 'fullName' || key === 'phone') && !fields[key]) fields[key] = issue.message;
    }
    return fail(400, 'validation_failed', MESSAGES.validation, Object.keys(fields).length ? fields : undefined);
  }
  const data = parsed.data;

  if (!env.TURNSTILE_SECRET_KEY || (env.TELEGRAM_DRY_RUN !== '1' && !(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID))) {
    console.error('Not configured: set TURNSTILE_SECRET_KEY, TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID with `wrangler secret put`');
    return fail(503, 'unavailable', MESSAGES.unavailable);
  }

  const ip = request.headers.get('cf-connecting-ip') ?? '0.0.0.0';
  const now = Date.now();
  const registry = env.REGISTRY.get(env.REGISTRY.idFromName('main'));
  // Set up to report orders from here (step 4)? Then the browser's pixel stays quiet.
  const meta = metaConfig(env, site);

  try {
    // 1. Already answered (the customer's phone lost our reply and retried)? Same answer again.
    const pre = await registry.check({ submissionId: data.submissionId, ip, phone: data.phone, now });
    if (pre.kind === 'replay') return answer(pre.status);
    if (pre.kind === 'limited') return fail(429, 'rate_limited', MESSAGES.rateLimited);

    // 2. Cloudflare Turnstile, checked with Cloudflare — never trusted from the browser.
    //    A failed or missing check does NOT refuse the order: on some phones and in-app
    //    browsers Turnstile cannot finish, and refusing would lose real customers. Such an
    //    order arrives marked "⚠️" for the operators; the per-IP and per-phone limits, the
    //    honeypot and the spam marking still hold scripted spam back.
    let check: { ok: boolean; errors: string[] } = { ok: false, errors: ['missing-input-response'] };
    if (data.turnstileToken) {
      try {
        check = await verifyTurnstile({
          secret: env.TURNSTILE_SECRET_KEY,
          token: data.turnstileToken,
          ip,
          submissionId: data.submissionId,
          hostname: url.hostname,
          verifyUrl: env.TURNSTILE_VERIFY_URL || undefined,
        });
      } catch (err) {
        if (!(err instanceof TurnstileUnavailable)) throw err;
        console.error('Turnstile siteverify unreachable');
        check = { ok: false, errors: ['siteverify-unreachable'] };
      }
    }
    if (!check.ok) {
      const configError = check.errors.find((e) => CONFIG_ERRORS.has(e));
      if (configError) {
        console.error(`Turnstile configuration error: ${configError} — every order is being refused`);
        ctx.waitUntil(
          registry.alert(
            `turnstile:${configError}`,
            `⚠️ <b>Сайт созламасида хато:</b> ${CONFIG_ALERT[configError]}. Буюртмалар «⚠️ текширув ўтмади» белгиси билан келяпти — дастурчига хабар беринг.`,
            now,
          ),
        );
      }
    }

    // 3. Signals for the operators; they do not block the order.
    const flags: string[] = [];
    if (data[HONEYPOT_FIELD]?.trim()) flags.push('honeypot');
    if (phoneLooksSynthetic(data.phone.slice(4))) flags.push('phone_pattern');
    if (!check.ok) flags.push('no_captcha');

    // 4. What Meta would need to match this customer, collected now because the IP, the
    //    user agent and the _fbp / _fbc cookies only exist during this request. Nothing is
    //    sent yet: the order is reported to Meta only once an operator has rung the
    //    customer and pressed an outcome, so the ads learn from real people instead of from
    //    everyone who can type a phone number. See meta.ts and registry.ts `reportToMeta`.
    //    (A partner-site order is the exception: nobody here rings it, so `acceptPartner`
    //    sends its Lead to the partner's own dataset at once.)
    const match = meta
      ? {
          userData: await buildUserData({
            phone: data.phone,
            fullName: data.fullName,
            ip,
            userAgent: request.headers.get('user-agent'),
            cookie: request.headers.get('cookie'),
          }),
          sourceUrl: request.headers.get('referer') || url.origin,
        }
      : undefined;

    // 5. New, repeat, or refused — decided and recorded in one place, one order at a time.
    const order = {
      submissionId: data.submissionId,
      ip,
      phone: data.phone,
      fullName: data.fullName,
      utm: data.utm,
      flags,
      now,
      meta: match,
      device: data.deviceId,
    };
    // The partner site's orders are its owner's alone: their sheet and dataset, never the group.
    const result = site === 'main' ? await registry.accept(order) : await registry.acceptPartner({ ...order, site });
    if (result.status === 'ip_limited') return fail(429, 'rate_limited', MESSAGES.ipDailyLimit);
    // The bot's webhook belongs to this Worker's own address, never to the partner site's.
    if (site === 'main') ctx.waitUntil(registry.ensureWebhook(url.origin));

    // Nothing is reported to Meta here, and the browser is never asked to either: a main-site
    // `Lead` is sent from `reportToMeta` once an operator has rung the customer. One order is
    // one event, and an order nobody could reach stays unreported.
    return answer(result.status);
  } catch (err) {
    // Never "accepted" unless it was recorded: anything unexpected is a clear "try again / call".
    console.error('Order failed', (err as Error)?.message);
    return fail(503, 'unavailable', MESSAGES.unavailable);
  }
}

/**
 * The partner site's door (sites.ts): its Cloudflare Pages function forwards each order here
 * over a service binding. A named entrypoint can be reached only through such a binding,
 * never from the internet, so whatever arrives here did come from that site.
 */
export class PartnerSite extends WorkerEntrypoint<Env> {
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/api/leads') return fail(404, 'not_found', MESSAGES.notFound);
    if (request.method !== 'POST') return fail(405, 'not_found', MESSAGES.notFound);
    return takeOrder(request, this.env, this.ctx, url, 't2');
  }
}

/** «Keraksiz» in the partner's Google Sheet: read back and remembered as spam (sheets.ts). */
async function syncPartnerSheet(env: Env, now: number): Promise<void> {
  const cfg = sheetsConfig(env, 't2');
  if (!cfg) return;
  const rows = await readSheetStatuses(cfg);
  if (rows) await env.REGISTRY.get(env.REGISTRY.idFromName('main')).syncPartnerSpam({ site: 't2', rows, now });
}

/**
 * Commands typed in the operators' group, delivered by Telegram's webhook:
 * /royxat sends the collected orders now, /holat reports that the bot is alive.
 * Accepted only with the secret header Telegram was given, and only from our own group.
 */
async function telegramCommand(request: Request, env: Env, origin: string): Promise<Response> {
  const ok = new Response('ok');
  if (!env.TELEGRAM_BOT_TOKEN || request.headers.get('x-telegram-bot-api-secret-token') !== (await webhookSecret(env.TELEGRAM_BOT_TOKEN))) {
    return new Response('forbidden', { status: 403 });
  }
  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  if (update?.callback_query) {
    await orderButton(update.callback_query, env).catch((err: unknown) => console.error('Telegram button failed', (err as Error)?.message));
    return ok;
  }
  const message = update?.message;
  if (!message?.chat) return ok;
  // A customer writing to the bot directly: the ordering conversation.
  if (message.chat.type === 'private') {
    await customerChat(message, env, origin).catch((err: unknown) => console.error('Bot conversation failed', (err as Error)?.message));
    return ok;
  }
  if (String(message.chat.id) !== String(env.TELEGRAM_CHAT_ID)) return ok;
  // "/royxat", "/royxat@bionexecobot", "/royxat ..." — the command word only.
  const command = /^\/([a-z_]+)(?:@\w+)?(?:\s|$)/i.exec(message.text?.trim() ?? '')?.[1]?.toLowerCase();
  if (!command) return ok;
  const registry = env.REGISTRY.get(env.REGISTRY.idFromName('main'));
  const now = Date.now();
  // Answer in the topic the command was typed in (undefined = the group's main chat).
  const thread = message.is_topic_message ? message.message_thread_id : undefined;
  try {
    // Topics turned on since the last check? Set them up now, before answering.
    await registry.ensureTopics();
    if (command === 'royxat' || command === 'list') await registry.listNow(now, thread);
    else if (command === 'holat' || command === 'status') await registry.reportStatus(now, thread);
    else if (command === 'hisobot' || command === 'report') await registry.dailyReport(now, thread);
    else if (command === 'panel' || command === 'crm') await sendPanelButton(env, Number(message.chat.id), thread);
    else if (command === 'start' || command === 'help' || command === 'yordam') await registry.notify(HELP_TEXT, now, thread);
  } catch (err) {
    console.error('Telegram command failed', (err as Error)?.message);
  }
  // Always 200: Telegram re-sends anything else (which could send a list twice); replies that
  // could not be delivered are retried by the outbox.
  return ok;
}

interface TelegramEntity {
  type: string;
  offset: number;
  length: number;
  [k: string]: unknown;
}
interface TelegramMessage {
  message_id?: number;
  chat?: { id?: number; type?: string };
  from?: { id: number; first_name?: string; last_name?: string };
  text?: string;
  contact?: { phone_number: string; user_id?: number };
  message_thread_id?: number;
  is_topic_message?: boolean;
}
interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string; last_name?: string; username?: string };
    data?: string;
    message?: { message_id: number; chat: { id: number }; text?: string; entities?: TelegramEntity[] };
  };
}

/**
 * "📞 Мен оламан" and the outcome buttons under an order. The registry decides (so only one
 * operator can take an order); then the message is rewritten with the operator's line.
 * The message's own text and formatting are reused, so no customer data is stored for this.
 */
async function orderButton(q: NonNullable<TelegramUpdate['callback_query']>, env: Env): Promise<void> {
  const cfg = { token: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_CHAT_ID, apiBase: env.TELEGRAM_API_BASE || undefined };
  const toast = async (text: string) => {
    await callTelegram(cfg, 'answerCallbackQuery', { callback_query_id: q.id, text, show_alert: false });
  };
  const msg = q.message;
  // Must list every outcome in outcomeKeyboard(): one missing here is a button that does nothing.
  const m = /^(t|r|s):(\d+)(?::(sold|noanswer|callback|rejected|spam))?$/.exec(q.data ?? '');
  if (!msg || !m || String(msg.chat.id) !== String(env.TELEGRAM_CHAT_ID)) return toast('Бу тугма ишламайди.');

  const leadId = Number(m[2]);
  const action = m[1] === 't' ? 'take' : m[1] === 'r' ? 'release' : (m[3] as LeadOutcome);
  const userName = [q.from.first_name, q.from.last_name].filter(Boolean).join(' ') || q.from.username || 'Оператор';
  const registry = env.REGISTRY.get(env.REGISTRY.idFromName('main'));
  const result = await registry.button({ leadId, action, userId: q.from.id, userName, now: Date.now() });

  if (result.changed && msg.text) {
    // Keep the order exactly as it was (with its formatting) and rewrite only the status part.
    const cut = msg.text.indexOf(STATUS_MARK);
    const base = cut >= 0 ? msg.text.slice(0, cut) : msg.text;
    const entities = (msg.entities ?? []).filter((e) => e.offset + e.length <= base.length);
    try {
      await callTelegram(cfg, 'editMessageText', {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        text: result.line ? `${base}${STATUS_MARK}${result.line}` : base,
        entities,
        link_preview_options: { is_disabled: true },
        reply_markup: result.keyboard === 'take' ? takeKeyboard(leadId) : outcomeKeyboard(leadId),
      });
    } catch (err) {
      // The choice is saved either way; only the message's look is behind.
      console.error('Could not update the order message', (err as Error)?.message);
    }
  }
  await toast(result.toast);
}

/**
 * /panel in the group: a message with the button that opens the operators' Mini App, pinned so
 * it is always one tap away. The Mini App is the bot's Main Mini App (BotFather → Bot Settings →
 * Configure Mini App → https://<site>/panel); web_app buttons are not allowed in groups, so this
 * is a t.me link that Telegram opens in-app.
 */
async function sendPanelButton(env: Env, chatId: number, thread?: number): Promise<void> {
  const cfg = { token: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_CHAT_ID, apiBase: env.TELEGRAM_API_BASE || undefined };
  const me = await callTelegram<{ username: string }>(cfg, 'getMe', {});
  const sent = await callTelegram<{ message_id: number }>(cfg, 'sendMessage', {
    chat_id: chatId,
    ...(thread ? { message_thread_id: thread } : {}),
    text: '📊 <b>Операторлар панели (Жадвал CRM)</b>\nБарча буюртмалар, таргет (кампания / ad set / видео) статистикаси, сотилди / сотилмади, спам. Фақат шу гуруҳ аъзолари учун.\n\n🖥 Компьютерда очиш учун ботга шахсий хабарда /panel деб ёзинг — ўзингизнинг ҳаволангизни оласиз.',
    parse_mode: 'HTML',
    reply_markup: panelKeyboard(`https://t.me/${me.username}?startapp=panel`),
  });
  await callTelegram(cfg, 'pinChatMessage', { chat_id: chatId, message_id: sent.message_id, disable_notification: true }).catch(() => undefined);
}

/** A customer ordering in a private chat with the bot (see bot.ts for the conversation). */
async function customerChat(message: TelegramMessage, env: Env, origin: string): Promise<void> {
  if (!message.from || !message.chat?.id) return;
  const cfg = { token: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_CHAT_ID, apiBase: env.TELEGRAM_API_BASE || undefined };
  // An operator can open the panel privately, without posting in the operators' group.
  // (web_app buttons work in private chats, so this needs no BotFather setup.)
  if (/^\/(panel|crm)\b/i.test(message.text?.trim() ?? '')) {
    const member = await isGroupMember(cfg, message.from.id);
    const name = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ') || 'Оператор';
    const key = member ? await signWebToken({ id: message.from.id, name }, env.TELEGRAM_BOT_TOKEN) : '';
    await callTelegram(cfg, 'sendMessage', {
      chat_id: message.chat.id,
      text: member ? '📊 <b>Операторлар панели (Жадвал CRM)</b>' : 'Бу буйруқ фақат операторлар учун.',
      parse_mode: 'HTML',
      ...(member
        ? {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📊 Панелни очиш', web_app: { url: `${origin}/panel` } }],
                [{ text: '🖥 Катта экранда очиш (Браузер CRM)', url: `${origin}/panel?key=${encodeURIComponent(key)}` }],
              ],
            },
          }
        : {}),
    });
    return;
  }
  const registry = env.REGISTRY.get(env.REGISTRY.idFromName('main'));
  const reply = await registry.botMessage({
    userId: message.from.id,
    firstName: message.from.first_name ?? '',
    text: message.text,
    contact: message.contact ? { phone: message.contact.phone_number, ownerId: message.contact.user_id } : undefined,
    now: Date.now(),
  });
  await callTelegram(cfg, 'sendMessage', { chat_id: message.chat.id, text: reply.text, parse_mode: 'HTML', reply_markup: reply.keyboard });
}

function answer(status: 'accepted' | 'duplicate'): Response {
  const body: LeadSubmitResponse = { status, message: MESSAGES[status] };
  return json(status === 'accepted' ? 201 : 200, body);
}

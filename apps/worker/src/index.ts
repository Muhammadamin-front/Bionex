import { HONEYPOT_FIELD, makeLeadSubmissionSchema, type ApiError, type ApiErrorCode, type LeadSubmitResponse } from '@bionex/shared/lead';
import { phoneLooksSynthetic } from '@bionex/shared/phone';
import { site } from '../../web/src/config/product';
import { metaConfig, sendMetaLead } from './meta';
import { panelApi, panelPage } from './panel';
import { callTelegram, HELP_TEXT, outcomeKeyboard, panelKeyboard, STATUS_MARK, takeKeyboard, webhookSecret, type LeadOutcome } from './telegram';
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
    // The operators' Mini App (served by the Worker for its own CSP, so Telegram can frame it).
    if (url.pathname === '/panel' && request.method === 'GET') return panelPage();
    if (url.pathname.startsWith('/api/panel/')) return panelApi(request, env, url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    if (url.pathname === '/api/telegram/hook' && request.method === 'POST') return telegramCommand(request, env);

    if (url.pathname === '/api/health' && request.method === 'GET') {
      // For a quick check after deploying. Says only whether settings exist, never their values.
      const registry = env.REGISTRY.get(env.REGISTRY.idFromName('main'));
      ctx.waitUntil(registry.ensureWebhook(url.origin));
      const queued = await registry.queued();
      return json(200, {
        ok: true,
        turnstileSecret: Boolean(env.TURNSTILE_SECRET_KEY),
        telegram: env.TELEGRAM_DRY_RUN === '1' ? 'dry-run' : Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
        /** Orders waiting because Telegram did not accept them yet; they are retried automatically. */
        waitingForTelegram: queued,
      });
    }
    if (url.pathname !== '/api/leads') return fail(404, 'not_found', MESSAGES.notFound);
    if (request.method !== 'POST') return fail(405, 'not_found', MESSAGES.notFound);

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

    try {
      // 1. Already answered (the customer's phone lost our reply and retried)? Same answer again.
      const pre = await registry.check({ submissionId: data.submissionId, ip, phone: data.phone, now });
      if (pre.kind === 'replay') return answer(pre.status);
      if (pre.kind === 'limited') return fail(429, 'rate_limited', MESSAGES.rateLimited);

      // 2. Cloudflare Turnstile, checked with Cloudflare — never trusted from the browser.
      if (!data.turnstileToken) return fail(403, 'turnstile_failed', MESSAGES.turnstile);
      let check;
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
        return fail(503, 'unavailable', MESSAGES.unavailable);
      }
      if (!check.ok) {
        const configError = check.errors.find((e) => CONFIG_ERRORS.has(e));
        if (configError) {
          console.error(`Turnstile configuration error: ${configError} — every order is being refused`);
          ctx.waitUntil(
            registry.alert(
              `turnstile:${configError}`,
              `⚠️ <b>Сайт созламасида хато:</b> ${CONFIG_ALERT[configError]}. Ҳозир барча буюртмалар рад этиляпти — дастурчига хабар беринг.`,
              now,
            ),
          );
        }
        return fail(403, 'turnstile_failed', MESSAGES.turnstile);
      }

      // 3. Signals for the operators; they do not block the order.
      const flags: string[] = [];
      if (data[HONEYPOT_FIELD]?.trim()) flags.push('honeypot');
      if (phoneLooksSynthetic(data.phone.slice(4))) flags.push('phone_pattern');

      // 4. New, repeat, or refused — decided and recorded in one place, one order at a time.
      const result = await registry.accept({
        submissionId: data.submissionId,
        ip,
        phone: data.phone,
        fullName: data.fullName,
        utm: data.utm,
        flags,
        now,
      });
      if (result.status === 'ip_limited') return fail(429, 'rate_limited', MESSAGES.ipDailyLimit);
      ctx.waitUntil(registry.ensureWebhook(url.origin));

      // 5. Tell Meta about the order from here too, so ad optimisation still sees it when the
      //    browser's pixel was blocked. Only genuinely new orders, exactly like the pixel —
      //    a repeat must not become a second Lead. Runs after the answer; never delays it.
      const meta = metaConfig(env);
      if (meta && result.status === 'accepted') {
        ctx.waitUntil(
          sendMetaLead(meta, {
            submissionId: data.submissionId,
            phone: data.phone,
            fullName: data.fullName,
            ip,
            userAgent: request.headers.get('user-agent'),
            cookie: request.headers.get('cookie'),
            sourceUrl: request.headers.get('referer') || url.origin,
            now,
          }),
        );
      }
      return answer(result.status);
    } catch (err) {
      // Never "accepted" unless it was recorded: anything unexpected is a clear "try again / call".
      console.error('Order failed', (err as Error)?.message);
      return fail(503, 'unavailable', MESSAGES.unavailable);
    }
  },

  /** Every evening (cron in wrangler.jsonc): the day's report to the group, which also shows the bot is alive. */
  async scheduled(_controller, env, ctx) {
    if (env.TELEGRAM_DRY_RUN !== '1' && !(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID)) return;
    ctx.waitUntil(env.REGISTRY.get(env.REGISTRY.idFromName('main')).dailyReport(Date.now()));
  },
} satisfies ExportedHandler<Env>;

/**
 * Commands typed in the operators' group, delivered by Telegram's webhook:
 * /royxat sends the collected orders now, /holat reports that the bot is alive.
 * Accepted only with the secret header Telegram was given, and only from our own group.
 */
async function telegramCommand(request: Request, env: Env): Promise<Response> {
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
    await customerChat(message, env).catch((err: unknown) => console.error('Bot conversation failed', (err as Error)?.message));
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
    else if (command === 'panel') await sendPanelButton(env, Number(message.chat.id), thread);
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
  const m = /^(t|r|s):(\d+)(?::(sold|noanswer|rejected))?$/.exec(q.data ?? '');
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
    text: '📊 <b>Операторлар панели</b>\nБарча буюртмалар, кунлик сонлар, сотилди / сотилмади, спам. Фақат шу гуруҳ аъзолари учун.',
    parse_mode: 'HTML',
    reply_markup: panelKeyboard(`https://t.me/${me.username}?startapp=panel`),
  });
  await callTelegram(cfg, 'pinChatMessage', { chat_id: chatId, message_id: sent.message_id, disable_notification: true }).catch(() => undefined);
}

/** A customer ordering in a private chat with the bot (see bot.ts for the conversation). */
async function customerChat(message: TelegramMessage, env: Env): Promise<void> {
  if (!message.from || !message.chat?.id) return;
  const registry = env.REGISTRY.get(env.REGISTRY.idFromName('main'));
  const reply = await registry.botMessage({
    userId: message.from.id,
    firstName: message.from.first_name ?? '',
    text: message.text,
    contact: message.contact ? { phone: message.contact.phone_number, ownerId: message.contact.user_id } : undefined,
    now: Date.now(),
  });
  const cfg = { token: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_CHAT_ID, apiBase: env.TELEGRAM_API_BASE || undefined };
  await callTelegram(cfg, 'sendMessage', { chat_id: message.chat.id, text: reply.text, parse_mode: 'HTML', reply_markup: reply.keyboard });
}

function answer(status: 'accepted' | 'duplicate'): Response {
  const body: LeadSubmitResponse = { status, message: MESSAGES[status] };
  return json(status === 'accepted' ? 201 : 200, body);
}

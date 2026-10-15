import { HONEYPOT_FIELD, makeLeadSubmissionSchema, type ApiError, type ApiErrorCode, type LeadSubmitResponse } from '@bionex/shared/lead';
import { phoneLooksSynthetic } from '@bionex/shared/phone';
import { site } from '../../web/src/config/product';
import { HELP_TEXT, webhookSecret } from './telegram';
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
      return answer(result.status);
    } catch (err) {
      // Never "accepted" unless it was recorded: anything unexpected is a clear "try again / call".
      console.error('Order failed', (err as Error)?.message);
      return fail(503, 'unavailable', MESSAGES.unavailable);
    }
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
  const update = (await request.json().catch(() => null)) as { message?: { chat?: { id?: number }; text?: string } } | null;
  const message = update?.message;
  if (!message || String(message.chat?.id) !== String(env.TELEGRAM_CHAT_ID)) return ok;
  // "/royxat", "/royxat@bionexecobot", "/royxat ..." — the command word only.
  const command = /^\/([a-z_]+)(?:@\w+)?(?:\s|$)/i.exec(message.text?.trim() ?? '')?.[1]?.toLowerCase();
  if (!command) return ok;
  const registry = env.REGISTRY.get(env.REGISTRY.idFromName('main'));
  const now = Date.now();
  try {
    if (command === 'royxat' || command === 'list') await registry.listNow(now);
    else if (command === 'holat' || command === 'status') await registry.reportStatus(now);
    else if (command === 'start' || command === 'help' || command === 'yordam') await registry.notify(HELP_TEXT, now);
  } catch (err) {
    console.error('Telegram command failed', (err as Error)?.message);
  }
  // Always 200: Telegram re-sends anything else (which could send a list twice); replies that
  // could not be delivered are retried by the outbox.
  return ok;
}

function answer(status: 'accepted' | 'duplicate'): Response {
  const body: LeadSubmitResponse = { status, message: MESSAGES[status] };
  return json(status === 'accepted' ? 201 : 200, body);
}

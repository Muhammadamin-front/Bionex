import { build } from 'esbuild';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { site } from '../../web/src/config/product';

/**
 * Runs the real Worker in workerd (the Cloudflare runtime) with its Durable Object.
 * Telegram, Turnstile and Meta are replaced by fakes that record what they receive.
 */

const SITE = 'https://zeynara.example';
const CHAT = '-1001234567890';
let script = '';
let mf: Miniflare;

/** Fake Telegram: every sendMessage body; `down` makes it fail like an outage. */
const telegram = {
  messages: [] as Array<{ chat_id: string; text: string; reply_parameters?: { message_id: number }; reply_markup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } }>,
  /** Other Bot API calls (setWebhook, setMyCommands) with their bodies. */
  calls: [] as Array<{ method: string; body: Record<string, unknown> }>,
  down: false,
  /** The group has Topics turned on (getChat → is_forum). */
  forum: false,
  /** Telegram user ids that are members of the operators' group. */
  members: new Set<number>(),
};
let turnstileCalls = 0;

/** Fake Meta Graph API: the Conversions API bodies and the events inside them. */
const meta = {
  bodies: [] as Array<{ access_token: string; test_event_code?: string; data: Array<Record<string, any>> }>,
  events: [] as Array<Record<string, any>>,
  /** The request path of each body: it names the dataset (/v21.0/<pixel id>/events). */
  paths: [] as string[],
};

/** Fake Apps Script web app of the partner's Google Sheet: every row it was sent, and its «Holat» column. */
const sheets = { rows: [] as Array<Record<string, any>>, statuses: [] as Array<[unknown, unknown]> };

async function outbound(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.hostname === 'graph.mock') {
    const body = (await request.json()) as { access_token: string; data: Array<Record<string, any>> };
    meta.bodies.push(body);
    meta.events.push(...body.data);
    meta.paths.push(url.pathname);
    return Response.json({ events_received: body.data.length, fbtrace_id: 'test' });
  }
  if (url.hostname === 'sheets.mock') {
    const body = (await request.json()) as Record<string, any>;
    if (body.secret !== 'sheet-secret') return new Response('forbidden');
    if (body.action === 'statuses') return Response.json(sheets.statuses);
    sheets.rows.push(body);
    return new Response('ok');
  }
  if (url.hostname === 'turnstile.mock') {
    turnstileCalls++;
    const form = await request.formData();
    const token = String(form.get('response'));
    const cdata = String(form.get('idempotency_key'));
    if (token === 'bad') return Response.json({ success: false, 'error-codes': ['invalid-input-response'] });
    if (token === 'wrong-secret') return Response.json({ success: false, 'error-codes': ['invalid-input-secret'] });
    return Response.json({
      success: true,
      action: 'lead-submit',
      cdata: token === 'other-form' ? 'something-else' : cdata,
      hostname: token === 'other-site' ? 'evil.example' : token === 'partner' ? 'zeynaraa-uz.example' : 'zeynara.example',
    });
  }
  if (url.hostname === 'telegram.mock') {
    if (telegram.down) return new Response('Bad Gateway', { status: 502 });
    const method = url.pathname.split('/').pop()!;
    if (method !== 'sendMessage') {
      telegram.calls.push({ method, body: await request.json() });
      if (method === 'getChat') return Response.json({ ok: true, result: { id: Number(CHAT), is_forum: telegram.forum } });
      if (method === 'getChatMember') {
        const body = telegram.calls.at(-1)!.body as { user_id: number };
        return Response.json({ ok: true, result: { status: telegram.members.has(body.user_id) ? 'member' : 'left' } });
      }
      if (method === 'getMe') return Response.json({ ok: true, result: { id: 1, username: 'bionexecobot' } });
      if (method === 'createForumTopic') {
        const n = telegram.calls.filter((c) => c.method === 'createForumTopic').length;
        return Response.json({ ok: true, result: { message_thread_id: 500 + n } });
      }
      return Response.json({ ok: true, result: true });
    }
    telegram.messages.push(await request.json());
    return Response.json({ ok: true, result: { message_id: 1000 + telegram.messages.length } });
  }
  return new Response('unexpected outbound request', { status: 500 });
}

function start(bindings: Record<string, string> = {}) {
  return new Miniflare(convertV4MiniflareOptions({
    name: 'zeynara',
    modules: true,
    script,
    compatibilityDate: '2026-10-01',
    durableObjects: { REGISTRY: { className: 'LeadRegistry', useSQLite: true } },
    serviceBindings: {
      ASSETS: () => new Response('<!doctype html><title>site</title>'),
      // What the partner site's Pages function is bound to (apps/partner/wrangler.jsonc).
      PARTNER: { name: 'zeynara', entrypoint: 'PartnerSite' },
    },
    outboundService: outbound,
    bindings: {
      IP_ORDERS_PER_HOUR: '3',
      LEADS_PER_IP_PER_DAY: '3',
      DUPLICATE_WINDOW_HOURS: '24',
      TURNSTILE_SECRET_KEY: '0x4AAAAAAA-real-looking-secret',
      TURNSTILE_VERIFY_URL: 'https://turnstile.mock/siteverify',
      TELEGRAM_BOT_TOKEN: '123456:test-token',
      TELEGRAM_CHAT_ID: CHAT,
      TELEGRAM_API_BASE: 'https://telegram.mock',
      ...bindings,
    },
  }));
}

let ids = 0;
const sid = () => `3f2c1d4e-5b6a-4c7d-8e9f-${String(++ids).padStart(12, '0')}`;

function order(body: Record<string, unknown> = {}, opts: { ip?: string; origin?: string | null; cookie?: string; userAgent?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'cf-connecting-ip': opts.ip ?? '198.51.100.7' };
  if (opts.origin !== null) headers.origin = opts.origin ?? SITE;
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.userAgent) headers['user-agent'] = opts.userAgent;
  return mf.dispatchFetch(`${SITE}/api/leads`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ fullName: 'Ойша Тошева', phone: '+998 90 312 45 67', submissionId: sid(), turnstileToken: 'good', ...body }),
  });
}
const leadMessages = () => telegram.messages.filter((m) => m.text.startsWith('🆕'));

/** Refusals offer the phone number only while the site shows one; never "call us" without a number. */
function expectCallHint(message: string, withoutPhone: RegExp) {
  if (site.phone) expect(message).toContain(site.phone);
  else {
    expect(message).toMatch(withoutPhone);
    expect(message).not.toMatch(/қўнғироқ/);
  }
}

beforeAll(async () => {
  const out = await build({
    // fileURLToPath, not .pathname: a folder with a space in its name arrives as %20 from
    // .pathname and esbuild then cannot find the file.
    entryPoints: [fileURLToPath(new URL('../src/index.ts', import.meta.url).href)],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    conditions: ['workerd', 'worker', 'browser'],
    mainFields: ['module', 'main'],
    external: ['cloudflare:*'],
    loader: { '.html': 'text' }, // like wrangler's default rule: the panel page is imported as text
    write: false,
  });
  script = out.outputFiles[0]!.text;
}, 60_000);

beforeEach(async () => {
  await mf?.dispose();
  mf = start();
  telegram.messages = [];
  telegram.calls = [];
  telegram.down = false;
  telegram.forum = false;
  telegram.members = new Set([11, 22]);
  turnstileCalls = 0;
  meta.bodies = [];
  meta.events = [];
  meta.paths = [];
  sheets.rows = [];
  sheets.statuses = [];
});

afterAll(async () => {
  await mf?.dispose();
});

describe('a new order', () => {
  it('is accepted and sent to the operators group', async () => {
    const res = await order({ utm: { source: 'facebook', campaign: 'kuz' } });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ status: 'accepted' });
    expect(leadMessages()).toHaveLength(1);
    const msg = leadMessages()[0]!;
    expect(msg.chat_id).toBe(CHAT);
    expect(msg.text).toContain('Ойша Тошева');
    expect(msg.text).toContain('+998 90 312 45 67');
    expect(msg.text).toContain('📣 Facebook · kuz');
  });

  it('escapes HTML coming from the visitor', async () => {
    await order({ utm: { source: '<b>x</b>&' } }).then((r) => expect(r.status).toBe(201));
    expect(leadMessages()[0]!.text).not.toContain('<b>x</b>');
  });

  it('flags a filled honeypot or a made-up looking number but still delivers it', async () => {
    await order({ contactFax: 'spam', phone: '+998 90 111 11 11' });
    expect(leadMessages()[0]!.text).toMatch(/бот бўлиши мумкин/);
    expect(leadMessages()[0]!.text).toMatch(/сунъийга ўхшайди/);
  });
});

describe('numbers and lists for the operators', () => {
  it('numbers every new order', async () => {
    await order({ phone: '+998 90 312 45 31' });
    await order({ phone: '+998 90 312 45 32' }, { ip: '203.0.113.21' });
    expect(leadMessages().map((m) => m.text.split('\n')[0])).toEqual(['🆕 <b>Янги буюртма №1</b>', '🆕 <b>Янги буюртма №2</b>']);
  });

  it('sends a numbered list after every N new orders, without counting repeats', async () => {
    await mf.dispose();
    mf = start({ LEADS_PER_LIST: '3' });
    const names = ['Алишер Каримов', 'Дилдора Ҳасанова', 'Рустам Носиров'];
    await order({ fullName: names[0], phone: '+998 90 312 45 41' }, { ip: '203.0.113.31' });
    await order({ fullName: names[0], phone: '+998 90 312 45 41' }, { ip: '203.0.113.31' }); // a repeat: no number, not listed
    await order({ fullName: names[1], phone: '+998 93 444 55 66', contactFax: 'bot' }, { ip: '203.0.113.32' });
    expect(telegram.messages.some((m) => m.text.startsWith('📋'))).toBe(false);
    await order({ fullName: names[2], phone: '+998 97 777 88 99' }, { ip: '203.0.113.33' });

    const list = telegram.messages.at(-1)!.text;
    expect(list.startsWith('📋 <b>Рўйхат: №1–№3</b> (3 та буюртма)')).toBe(true);
    expect(list).toMatch(/<b>1\.<\/b> Алишер Каримов · \d\d:\d\d · ⏳ олинмаган\n📞 \+998 90 312 45 41/);
    expect(list).toMatch(/<b>2\.<\/b> Дилдора Ҳасанова · .* ⚠️\n📞 \+998 93 444 55 66/);
    expect(list).toMatch(/<b>3\.<\/b> Рустам Носиров · .*\n📞 \+998 97 777 88 99/);
    // The phone stands alone on its line, so copying it never takes the time along.
    expect(list.split('\n').filter((l) => l.startsWith('📞')).every((l) => /^📞 \+998 \d\d \d{3} \d\d \d\d$/.test(l))).toBe(true);
    // The next list starts again from the next order.
    await order({ phone: '+998 91 222 33 44' }, { ip: '203.0.113.34' });
    expect(telegram.messages.filter((m) => m.text.startsWith('📋'))).toHaveLength(1);
  });

  it('can turn the lists off', async () => {
    await mf.dispose();
    mf = start({ LEADS_PER_LIST: '0' });
    for (let i = 0; i < 3; i++) await order({ phone: `+998 90 312 45 5${i}` }, { ip: `203.0.113.4${i}` });
    expect(telegram.messages.some((m) => m.text.startsWith('📋'))).toBe(false);
  });
});

describe('bot status and commands in the group', () => {
  const secret = async () => {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('zeynara-webhook:123456:test-token'));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  async function command(text: string, opts: { chatId?: string; secret?: string } = {}) {
    return mf.dispatchFetch(`${SITE}/api/telegram/hook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': opts.secret ?? (await secret()) },
      body: JSON.stringify({ update_id: 1, message: { message_id: 5, chat: { id: Number(opts.chatId ?? CHAT), type: 'supergroup' }, text } }),
    });
  }

  it('says under every order how many are collected and how many until the list', async () => {
    await order({ phone: '+998 90 312 45 61' });
    expect(leadMessages()[0]!.text).toContain('📋 Рўйхатда 1 та. Яна 9 та келса, рўйхатни юбораман');
  });

  it('/royxat shows all of today\'s orders with their status, every time it is pressed', async () => {
    await command('/royxat');
    expect(telegram.messages.at(-1)!.text).toBe('📋 Бугун ҳали буюртма йўқ.');
    await order({ fullName: 'Алишер Каримов', phone: '+998 90 312 45 62' }, { ip: '203.0.113.51' });
    await order({ fullName: 'Барно Олимова', phone: '+998 90 312 45 63' }, { ip: '203.0.113.52' });
    expect((await command('/royxat@bionexecobot')).status).toBe(200);
    const first = telegram.messages.at(-1)!.text;
    expect(first).toMatch(/^📋 <b>Бугунги буюртмалар \(\d\d\.\d\d\)<\/b> — 2 та\n⏳ Олинмаган: 2/);
    expect(first).toContain('Алишер Каримов');
    expect(first).toContain('📞 +998 90 312 45 63');
    // Pressed again: the same orders again, nothing used up.
    await command('/royxat');
    expect(telegram.messages.at(-1)!.text).toBe(first);
    // And the 10-order counter is not reset by it.
    await order({ phone: '+998 90 312 45 64' }, { ip: '203.0.113.53' });
    expect(leadMessages().at(-1)!.text).toContain('Рўйхатда 3 та. Яна 7 та');
  });

  it('/holat answers that the bot is alive, with the numbers', async () => {
    await order({ phone: '+998 90 312 45 65' });
    await command('/holat');
    const status = telegram.messages.at(-1)!.text;
    expect(status).toContain('✅ <b>Бот ишлаяпти.</b>');
    expect(status).toContain('Рўйхатда 1 та');
    expect(status).toContain('Бугун: 1 та янги буюртма');
    expect(status).toContain('Барча хабарлар етказилган');
  });

  it('ignores calls without the secret and messages from other chats', async () => {
    await order({ phone: '+998 90 312 45 66' });
    const before = telegram.messages.length;
    expect((await command('/royxat', { secret: 'guess' })).status).toBe(403);
    expect((await command('/royxat', { chatId: '-100555' })).status).toBe(200);
    expect((await command('salom')).status).toBe(200);
    expect(telegram.messages.length).toBe(before);
  });

  it('connects the bot to the site by itself, once', async () => {
    await mf.dispatchFetch(`${SITE}/api/health`);
    await order({ phone: '+998 90 312 45 67' });
    await mf.dispatchFetch(`${SITE}/api/health`);
    await new Promise((r) => setTimeout(r, 200));
    const hooks = telegram.calls.filter((c) => c.method === 'setWebhook');
    expect(hooks).toHaveLength(1);
    expect(hooks[0]!.body).toMatchObject({ url: `${SITE}/api/telegram/hook`, secret_token: await secret() });
    expect(telegram.calls.some((c) => c.method === 'setMyCommands')).toBe(true);
  });
});

describe('order buttons, copyable phone and the daily report', () => {
  const secret = async () => {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('zeynara-webhook:123456:test-token'));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  const hook = async (update: unknown) =>
    mf.dispatchFetch(`${SITE}/api/telegram/hook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': await secret() },
      body: JSON.stringify({ update_id: 1, ...(update as object) }),
    });
  /** What Telegram hands back on a button press: the message as plain text plus its entities. */
  let shownText = '🆕 Янги буюртма №1\n👤 Ойша Тошева\n📞 +998 90 312 45 67';
  const press = (data: string, user: { id: number; first_name: string }, chatId = CHAT) =>
    hook({
      callback_query: {
        id: `cb${Math.random()}`,
        from: user,
        data,
        message: { message_id: 1001, chat: { id: Number(chatId) }, text: shownText, entities: [{ type: 'bold', offset: 0, length: 18 }] },
      },
    });
  const lastEdit = () => telegram.calls.filter((c) => c.method === 'editMessageText').at(-1)?.body as
    | { text: string; entities: unknown[]; reply_markup: { inline_keyboard: Array<Array<{ callback_data: string }>> } }
    | undefined;
  const lastToast = () => (telegram.calls.filter((c) => c.method === 'answerCallbackQuery').at(-1)?.body as { text: string }).text;
  const ali = { id: 11, first_name: 'Ойша' };
  const bek = { id: 22, first_name: 'Дилноза' };

  beforeEach(() => {
    shownText = '🆕 Янги буюртма №1\n👤 Ойша Тошева\n📞 +998 90 312 45 67';
  });

  it('the group 🚫 Спам button marks the order and flags the next one from the same source', async () => {
    await order({ fullName: 'Ёлғон Исм', phone: '+998 90 312 45 96' }, { ip: '198.51.100.98' });
    await press('t:1', ali);
    shownText = lastEdit()!.text;
    await press('s:1:spam', ali);
    expect(lastToast()).not.toBe('Бу тугма ишламайди.');
    expect(lastEdit()!.text).toContain('🚫');
    await order({ fullName: 'Бошқа Исм', phone: '+998 90 312 45 97' }, { ip: '198.51.100.98' });
    expect(leadMessages().at(-1)!.text).toContain('бу манбадан аввал спам белгиланган');
  });

  it('puts a tappable phone and a "take" button under every order', async () => {
    await order({ phone: '+998 90 312 45 67' });
    const msg = leadMessages()[0]!;
    expect(msg.text).toContain('📞 +998 90 312 45 67'); // plain: Telegram offers Call / Copy
    expect(msg.text).not.toContain('Манба'); // only shown when something looks off
    expect(msg.reply_markup?.inline_keyboard[0]![0]).toEqual({ text: '📞 Мен оламан', callback_data: 't:1' });
  });

  it('gives an order to the first operator who takes it, then records the outcome', async () => {
    await order({ phone: '+998 90 312 45 67' });
    await press('t:1', ali);
    let edit = lastEdit()!;
    expect(edit.text).toMatch(/━━━━━━━━━━\n📞 Ойша олди — \d\d\.\d\d, \d\d:\d\d$/);
    expect(edit.entities).toEqual([{ type: 'bold', offset: 0, length: 18 }]);
    expect(edit.reply_markup.inline_keyboard.flat().map((b) => b.callback_data)).toEqual([
      's:1:sold',
      's:1:rejected',
      's:1:noanswer',
      's:1:callback',
      'r:1',
      's:1:spam',
    ]);
    expect(lastToast()).toMatch(/Сиз олдингиз/);

    shownText = edit.text;
    const edits = telegram.calls.filter((c) => c.method === 'editMessageText').length;
    await press('t:1', bek);
    expect(lastToast()).toBe('Бу буюртмани Ойша олган.');
    await press('s:1:sold', bek);
    expect(telegram.calls.filter((c) => c.method === 'editMessageText').length).toBe(edits);

    await press('s:1:sold', ali);
    edit = lastEdit()!;
    expect(edit.text.split('━━━━━━━━━━').length).toBe(2); // the status is replaced, not stacked
    expect(edit.text).toMatch(/✅ Сотилди — Ойша, /);
  });

  it('lets an order be handed back for someone else', async () => {
    await order({ phone: '+998 90 312 45 67' });
    await press('t:1', ali);
    shownText = lastEdit()!.text;
    await press('r:1', ali);
    const edit = lastEdit()!;
    expect(edit.text).toBe('🆕 Янги буюртма №1\n👤 Ойша Тошева\n📞 +998 90 312 45 67');
    expect(edit.reply_markup.inline_keyboard[0]![0]!.callback_data).toBe('t:1');
    await press('t:1', bek);
    expect(lastEdit()!.text).toMatch(/Дилноза олди/);
  });

  it('ignores buttons from other chats', async () => {
    await order({ phone: '+998 90 312 45 67' });
    await press('t:1', ali, '-100555');
    expect(lastEdit()).toBeUndefined();
    expect(lastToast()).toBe('Бу тугма ишламайди.');
  });

  it('/hisobot and the evening cron report the day, per operator', async () => {
    await order({ fullName: 'Алишер Каримов', phone: '+998 90 312 45 71' }, { ip: '203.0.113.71' });
    await order({ fullName: 'Барно Олимова', phone: '+998 90 312 45 72' }, { ip: '203.0.113.72' });
    await order({ fullName: 'Рустам Носиров', phone: '+998 90 312 45 73' }, { ip: '203.0.113.73' });
    await press('s:1:sold', ali);
    await press('t:2', bek);
    await press('s:2:noanswer', bek);
    await hook({ message: { message_id: 9, chat: { id: Number(CHAT) }, text: '/hisobot' } });
    const report = telegram.messages.at(-1)!.text;
    expect(report).toContain('🆕 Янги буюртмалар: 3');
    expect(report).toContain('✅ Сотилди: 1');
    expect(report).toContain('🔁 Кўтармади: 1');
    expect(report).toContain('⏳ Ҳеч ким олмаган: 1');
    expect(report).toContain('• Ойша — 1 та олди, 1 та сотди');
    expect(report).toContain('• Дилноза — 1 та олди, 0 та сотди');

    await hook({ message: { message_id: 10, chat: { id: Number(CHAT) }, text: '/royxat' } });
    const list = telegram.messages.at(-1)!.text;
    expect(list).toMatch(/<b>1\.<\/b> Алишер Каримов · \d\d:\d\d · ✅ Сотилди \(Ойша\)/);
    expect(list).toMatch(/<b>2\.<\/b> Барно Олимова · \d\d:\d\d · 🔁 Кўтармади \(Дилноза\)/);
    expect(list).toMatch(/<b>3\.<\/b> Рустам Носиров · \d\d:\d\d · ⏳ олинмаган/);

    const before = telegram.messages.length;
    const worker = (await mf.getWorker()) as unknown as { scheduled(o: { cron: string }): Promise<unknown> };
    await worker.scheduled({ cron: '0 15 * * *' });
    await new Promise((r) => setTimeout(r, 300));
    expect(telegram.messages.length).toBe(before + 1);
    expect(telegram.messages.at(-1)!.text).toMatch(/^📊 <b>Ҳисобот/);
  });
});

describe('ordering through the bot in a private chat', () => {
  const secret = async () => {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('zeynara-webhook:123456:test-token'));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  const say = async (msg: Record<string, unknown>, user = { id: 777, first_name: 'Ойша' }) => {
    await mf.dispatchFetch(`${SITE}/api/telegram/hook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': await secret() },
      body: JSON.stringify({ update_id: 1, message: { message_id: 1, chat: { id: user.id, type: 'private' }, from: user, ...msg } }),
    });
    return telegram.messages.filter((m) => String(m.chat_id) === String(user.id)).at(-1) as
      | { text: string; reply_markup: { keyboard?: Array<Array<{ text: string; request_contact?: boolean }>>; remove_keyboard?: boolean } }
      | undefined;
  };

  it('takes an order: Start → share the number → name → the group gets it', async () => {
    let reply = await say({ text: '/start' });
    expect(reply!.text).toMatch(/^Ассалому алайкум, Ойша!/);
    expect(reply!.reply_markup.keyboard![0]![0]).toEqual({ text: '📱 Рақамни юбориш', request_contact: true });

    reply = await say({ contact: { phone_number: '998903124567', user_id: 777 } });
    expect(reply!.text).toMatch(/исмингизни ёзинг/);
    expect(reply!.reply_markup.keyboard![0]![0]!.text).toBe('Ойша'); // one tap

    reply = await say({ text: 'Ойша Тошева' });
    expect(reply!.text).toMatch(/Буюртмангиз қабул қилинди \(№1\)/);
    expect(reply!.reply_markup.remove_keyboard).toBe(true);

    const lead = leadMessages().at(-1)!;
    expect(lead.text).toContain('Ойша Тошева');
    expect(lead.text).toContain('+998 90 312 45 67');
    expect(lead.text).toContain('🤖 Telegram бот орқали · рақам тасдиқланган ✅');
    expect(lead.reply_markup?.inline_keyboard[0]![0]!.callback_data).toBe('t:1');
  });

  it('accepts a typed number too, marked as not confirmed by Telegram', async () => {
    await say({ text: '/start' });
    await say({ text: '8 90 312 45 68' });
    await say({ text: 'Рустам' });
    expect(leadMessages().at(-1)!.text).toContain('рақам қўлда ёзилган');
  });

  it("refuses someone else's contact and a bad number, and asks again", async () => {
    await say({ text: '/start' });
    let reply = await say({ contact: { phone_number: '998903124569', user_id: 999 } });
    expect(reply!.text).toMatch(/ўзингизнинг рақамингизни/);
    reply = await say({ text: '12345' });
    expect(reply!.text).toMatch(/нотўғри/);
    reply = await say({ text: 'салом' });
    expect(reply!.text).toMatch(/Рақамни юбориш/);
    expect(leadMessages()).toHaveLength(0);
  });

  it('test mode (t.me/<bot>?start=test) goes through every step but creates no order', async () => {
    let reply = await say({ text: '/start test' });
    expect(reply!.text).toMatch(/СИНОВ РЕЖИМИ/);
    await say({ contact: { phone_number: '998903124590', user_id: 777 } });
    reply = await say({ text: 'Ойша' });
    expect(reply!.text).toMatch(/Синов тугади/);
    expect(leadMessages()).toHaveLength(0);
    const note = telegram.messages.find((m) => String(m.chat_id) === CHAT && m.text.startsWith('🧪'))!;
    expect(note.text).toContain('қўнғироқ қилманг');
    expect(note.text).toContain('+998 90 312 45 90');
    expect(note.reply_markup).toBeUndefined(); // no "take" button: nothing to call
    // A normal order afterwards is still №1: the test used no number.
    await say({ text: '/start' });
    await say({ contact: { phone_number: '998903124591', user_id: 777 } });
    reply = await say({ text: 'Ойша' });
    expect(reply!.text).toMatch(/№1\)/);
  });

  it('treats the same number again as already received', async () => {
    for (let i = 0; i < 2; i++) {
      await say({ text: '/start' });
      await say({ contact: { phone_number: '998903124570', user_id: 777 } });
      const reply = await say({ text: 'Ойша' });
      if (i === 1) expect(reply!.text).toMatch(/аллақачон қабул қилинган/);
    }
    expect(leadMessages()).toHaveLength(1);
  });
});

describe('group topics and the source line', () => {
  it('shows where the visitor came from in plain words, without ad ids', async () => {
    await order({ utm: { source: 'ig', campaign: '120253199231260134', content: '120253199231280134' } });
    const text = leadMessages()[0]!.text;
    expect(text).toContain('📣 Instagram');
    expect(text).not.toContain('120253199231260134');
  });

  it('names the ad set and the ad, so two live campaigns cannot be confused', async () => {
    await order({ utm: { source: 'facebook', campaign: 'Qon bosimi Old', term: 'UZ 30-55', content: 'old-video' } });
    expect(leadMessages()[0]!.text).toContain('📣 Facebook · Qon bosimi Old · UZ 30-55 · old-video');
  });

  it('says a repeated name once: a duplicated campaign keeps the original ad set and ad names', async () => {
    await order({ utm: { source: 'facebook', campaign: 'Qon bosimi', term: 'Qon bosimi', content: 'Qon bosimi' } });
    expect(leadMessages()[0]!.text).toMatch(/📣 Facebook · Qon bosimi(\n|$)/);
  });

  it('with Topics on, orders go to "🆕 Буюртмалар" and lists/reports to "📊 Ҳисобот"', async () => {
    await mf.dispose();
    mf = start({ LEADS_PER_LIST: '2' });
    telegram.forum = true;
    await mf.dispatchFetch(`${SITE}/api/health`);
    await new Promise((r) => setTimeout(r, 300));
    const topics = telegram.calls.filter((c) => c.method === 'createForumTopic').map((c) => c.body.name);
    expect(topics).toEqual(['🆕 Буюртмалар', '📊 Ҳисобот']);

    await order({ phone: '+998 90 312 45 81' }, { ip: '203.0.113.81' });
    await order({ phone: '+998 90 312 45 82' }, { ip: '203.0.113.82' });
    const sent = telegram.messages as Array<{ text: string; message_thread_id?: number }>;
    expect(sent.filter((m) => m.text.startsWith('🆕')).every((m) => m.message_thread_id === 501)).toBe(true);
    expect(sent.find((m) => m.text.startsWith('📋'))!.message_thread_id).toBe(502);
  });
});

describe("the operators' Mini App panel", () => {
  const TOKEN = '123456:test-token';
  const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  const hmac = async (key: ArrayBuffer | Uint8Array, data: string) =>
    crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), new TextEncoder().encode(data));
  /** initData exactly as Telegram signs it for a Mini App user. */
  async function initData(user: { id: number; first_name: string }, opts: { authDate?: number; token?: string } = {}) {
    const fields: Record<string, string> = {
      auth_date: String(opts.authDate ?? Math.floor(Date.now() / 1000)),
      query_id: 'AAH',
      user: JSON.stringify(user),
    };
    const check = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
    const secret = await hmac(new TextEncoder().encode('WebAppData'), opts.token ?? TOKEN);
    return new URLSearchParams({ ...fields, hash: hex(await hmac(secret, check)) }).toString();
  }
  const ali = { id: 11, first_name: 'Ойша' };
  const panel = async (path: string, init: { auth?: string; method?: string; body?: unknown } = {}) =>
    mf.dispatchFetch(`${SITE}${path}`, {
      method: init.method ?? 'GET',
      headers: { ...(init.auth !== undefined ? { authorization: `tma ${init.auth}` } : {}), 'content-type': 'application/json' },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });

  it('serves the page with its own CSP that lets Telegram frame it', async () => {
    const res = await mf.dispatchFetch(`${SITE}/panel`);
    expect(res.status).toBe(200);
    const csp = res.headers.get('content-security-policy')!;
    expect(csp).toMatch(/script-src 'nonce-[0-9a-f]{32}'/);
    expect(csp).toContain('frame-ancestors https://web.telegram.org');
    const html = await res.text();
    expect(html).toContain('<script nonce="');
    expect(html).not.toContain('{{NONCE}}');
  });

  it('refuses a missing or forged signature, an old one, and people outside the group', async () => {
    expect((await panel('/api/panel/data')).status).toBe(401);
    expect((await panel('/api/panel/data', { auth: await initData(ali, { token: '999:other-bot' }) })).status).toBe(401);
    const stale = await initData(ali, { authDate: Math.floor(Date.now() / 1000) - 2 * 86400 });
    expect((await panel('/api/panel/data', { auth: stale })).status).toBe(401);
    const stranger = await panel('/api/panel/data', { auth: await initData({ id: 555, first_name: 'Бегона' }) });
    expect(stranger.status).toBe(403);
    expect(((await stranger.json()) as { message: string }).message).toMatch(/гуруҳи аъзолари/);
  });

  it('shows orders and 14 days of numbers to a group member', async () => {
    await order({ fullName: 'Алишер Каримов', phone: '+998 90 312 45 91', utm: { source: 'ig' } }, { ip: '203.0.113.91' });
    await order({ fullName: 'Барно Олимова', phone: '+998 90 312 45 92' }, { ip: '203.0.113.92' });
    const res = await panel('/api/panel/data?days=1', { auth: await initData(ali) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { me: { id: number }; leads: Array<{ number: number; name: string; phone: string; source: string | null }>; days: Array<{ total: number }> };
    expect(data.me.id).toBe(11);
    expect(data.leads.map((l) => l.name)).toEqual(['Барно Олимова', 'Алишер Каримов']); // newest first
    expect(data.leads[1]).toMatchObject({ number: 1, phone: '+998903124591', source: 'Instagram' });
    expect(data.days).toHaveLength(14);
    expect(data.days.at(-1)!.total).toBe(2);
  });

  it('takes and closes an order from the panel and updates the group message too', async () => {
    await order({ fullName: 'Алишер Каримов', phone: '+998 90 312 45 93' }, { ip: '203.0.113.93' });
    const auth = await initData(ali);
    let r = await panel('/api/panel/action', { auth, method: 'POST', body: { leadId: 1, action: 'take' } });
    expect(((await r.json()) as { changed: boolean }).changed).toBe(true);
    let edit = telegram.calls.filter((c) => c.method === 'editMessageText').at(-1)!.body as { text: string; parse_mode: string; message_id: number };
    expect(edit.message_id).toBe(1001);
    expect(edit.parse_mode).toBe('HTML');
    expect(edit.text).toMatch(/^🆕 <b>Янги буюртма №1<\/b>/);
    expect(edit.text).toMatch(/━━━━━━━━━━\n📞 Ойша олди/);

    r = await panel('/api/panel/action', { auth, method: 'POST', body: { leadId: 1, action: 'sold' } });
    edit = telegram.calls.filter((c) => c.method === 'editMessageText').at(-1)!.body as typeof edit;
    expect(edit.text).toMatch(/✅ Сотилди — Ойша/);
    const data = (await (await panel('/api/panel/data', { auth })).json()) as { leads: Array<{ outcome: string; takerName: string }> };
    expect(data.leads[0]).toMatchObject({ outcome: 'sold', takerName: 'Ойша' });
    expect((await panel('/api/panel/action', { auth, method: 'POST', body: { leadId: 1, action: 'delete-all' } })).status).toBe(400);
  });

  it('marking spam flags the next order from the same source', async () => {
    await order({ fullName: 'Ёлғон Исм', phone: '+998 90 312 45 94' }, { ip: '198.51.100.99' });
    await panel('/api/panel/action', { auth: await initData(ali), method: 'POST', body: { leadId: 1, action: 'spam' } });
    await order({ fullName: 'Бошқа Исм', phone: '+998 90 312 45 95' }, { ip: '198.51.100.99' });
    expect(leadMessages().at(-1)!.text).toContain('бу манбадан аввал спам белгиланган');
    await hook({ message: { message_id: 3, chat: { id: Number(CHAT) }, text: '/hisobot' } });
    expect(telegram.messages.at(-1)!.text).toContain('🚫 Спам: 1');
  });

  it('/panel posts and pins the button that opens the panel', async () => {
    await hook({ message: { message_id: 4, chat: { id: Number(CHAT) }, from: { id: 11, first_name: 'Ойша' }, text: '/panel' } });
    const msg = telegram.messages.at(-1) as unknown as { text: string; reply_markup: { inline_keyboard: Array<Array<{ url: string }>> } };
    expect(msg.text).toContain('Операторлар панели');
    expect(msg.reply_markup.inline_keyboard[0]![0]!.url).toBe('https://t.me/bionexecobot?startapp=panel');
    // A personal browser key is never posted (and pinned) where the whole group sees it.
    expect(msg.reply_markup.inline_keyboard).toHaveLength(1);
    expect(JSON.stringify(msg)).not.toContain('key=');
    expect(telegram.calls.some((c) => c.method === 'pinChatMessage')).toBe(true);
  });

  it('/panel in a private chat gives a group member the panel button, and nobody else', async () => {
    const dm = (userId: number) =>
      hook({ message: { message_id: 5, chat: { id: userId, type: 'private' }, from: { id: userId, first_name: 'X' }, text: '/panel' } });
    await dm(11);
    const mine = telegram.messages.at(-1) as unknown as {
      chat_id: number;
      reply_markup: { inline_keyboard: Array<Array<{ web_app?: { url: string }; url?: string }>> };
    };
    expect(mine.chat_id).toBe(11);
    expect(mine.reply_markup.inline_keyboard[0]![0]!.web_app!.url).toBe(`${SITE}/panel`);
    // Also provides a signed browser link for the full-screen Table CRM.
    const webUrl = mine.reply_markup.inline_keyboard[1]![0]!.url!;
    expect(webUrl).toContain(`${SITE}/panel?key=`);
    const key = new URL(webUrl).searchParams.get('key')!;
    const webRes = await mf.dispatchFetch(`${SITE}/api/panel/data?days=1`, {
      headers: { authorization: `web ${key}` },
    });
    expect(webRes.status).toBe(200);

    await dm(555);
    const other = telegram.messages.at(-1) as unknown as { text: string; reply_markup?: unknown };
    expect(other.text).toBe('Бу буйруқ фақат операторлар учун.');
    expect(other.reply_markup).toBeUndefined();
  });

  it('keeps campaign, ad set (utm_term) and video (utm_content) per lead', async () => {
    await order(
      {
        fullName: 'Дилноза Каримова',
        phone: '+998 90 312 45 96',
        utm: { source: 'facebook', campaign: 'qon-bosimi', term: 'A | Video 1-2 | UZ 30-55', content: 'video1' },
      },
      { ip: '203.0.113.96' },
    );
    // No utm_term: the ad set stays unknown rather than guessed from the video's name.
    await order({ fullName: 'Санжар Рахимов', phone: '+998 90 312 45 97', utm: { source: 'facebook', campaign: 'qon-bosimi', content: 'video3' } }, { ip: '203.0.113.97' });
    const data = (await (await panel('/api/panel/data?days=7', { auth: await initData(ali) })).json()) as {
      leads: Array<{ number: number; platform: string | null; campaign: string | null; adset: string | null; ad: string | null }>;
      truncated: boolean;
    };
    expect(data.truncated).toBe(false);
    expect(data.leads[0]).toMatchObject({ number: 2, platform: 'Facebook', campaign: 'qon-bosimi', adset: null, ad: 'video3' });
    expect(data.leads[1]).toMatchObject({ number: 1, platform: 'Facebook', campaign: 'qon-bosimi', adset: 'A | Video 1-2 | UZ 30-55', ad: 'video1' });
  });

  it('clearing the panel moves every order to the archive, where it can still be worked', async () => {
    await order({ fullName: 'Эски Буюртма', phone: '+998 90 312 45 98' }, { ip: '203.0.113.98' });
    const auth = await initData(ali);
    expect((await panel('/api/panel/archive', { auth, method: 'GET' })).status).toBe(404);
    const r = (await (await panel('/api/panel/archive', { auth, method: 'POST' })).json()) as { moved: number; open: number };
    expect(r).toMatchObject({ moved: 1, open: 1 });
    expect(telegram.messages.at(-1)!.text).toContain('1 та буюртма архивга ўтди');

    await order({ fullName: 'Янги Буюртма', phone: '+998 90 312 45 99' }, { ip: '203.0.113.99' });
    type Data = { leads: Array<{ name: string }>; archived: number; days: Array<{ total: number }> };
    const current = (await (await panel('/api/panel/data?days=1', { auth })).json()) as Data;
    expect(current.leads.map((l) => l.name)).toEqual(['Янги Буюртма']);
    expect(current.archived).toBe(1);
    expect(current.days.at(-1)!.total).toBe(2); // the daily totals are not touched
    const archive = (await (await panel('/api/panel/data?days=1&archive=1', { auth })).json()) as Data;
    expect(archive.leads.map((l) => l.name)).toEqual(['Эски Буюртма']);
    expect(((await (await panel('/api/panel/action', { auth, method: 'POST', body: { leadId: 1, action: 'take' } })).json()) as { changed: boolean }).changed).toBe(true);
    // Only group members can clear it.
    expect((await panel('/api/panel/archive', { auth: await initData({ id: 555, first_name: 'Бегона' }), method: 'POST' })).status).toBe(403);
    expect(((await (await panel('/api/panel/archive', { auth, method: 'POST' })).json()) as { moved: number }).moved).toBe(1);
  });

  async function hook(update: unknown) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`zeynara-webhook:${TOKEN}`));
    return mf.dispatchFetch(`${SITE}/api/telegram/hook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': hex(d) },
      body: JSON.stringify({ update_id: 1, ...(update as object) }),
    });
  }
});

describe('repeats and retries', () => {
  it('treats the same number again as a repeat, replying to the first message', async () => {
    expect((await order()).status).toBe(201);
    const again = await order();
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ status: 'duplicate' });
    expect(leadMessages()).toHaveLength(1);
    const note = telegram.messages.find((m) => m.text.startsWith('🔁'))!;
    expect(note.reply_parameters?.message_id).toBe(1001);
  });

  it('answers a retry of the same attempt with the same result, without asking Turnstile again', async () => {
    const id = sid();
    expect((await order({ submissionId: id })).status).toBe(201);
    const calls = turnstileCalls;
    const retry = await order({ submissionId: id, turnstileToken: 'already-spent' });
    expect(retry.status).toBe(201);
    expect(turnstileCalls).toBe(calls);
    expect(leadMessages()).toHaveLength(1);
  });

  it('never creates two orders from simultaneous submissions of one number', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => order({}, { ip: `203.0.113.${i + 1}` }).then((r) => r.status)));
    expect(results.filter((s) => s === 201)).toHaveLength(1);
    expect(results.filter((s) => s === 200)).toHaveLength(4);
    expect(leadMessages()).toHaveLength(1);
  });

  it('keeps the order when Telegram is down and reports it as waiting', async () => {
    telegram.down = true;
    expect((await order()).status).toBe(201);
    const health = (await (await mf.dispatchFetch(`${SITE}/api/health`)).json()) as { waitingForTelegram: number };
    expect(health.waitingForTelegram).toBe(1);
  });
});

describe('spam protection', () => {
  it('lets one IP order for 3 different numbers a day, then refuses', async () => {
    await mf.dispose();
    mf = start({ IP_ORDERS_PER_HOUR: '100' }); // the daily cap alone, without the hourly one
    const statuses = [];
    for (const n of ['61', '62', '63', '64']) statuses.push((await order({ phone: `+998 90 312 45 ${n}` })).status);
    expect(statuses).toEqual([201, 201, 201, 429]);
    const refused = await order({ phone: '+998 90 312 45 65' });
    expectCallHint(((await refused.json()) as { error: { message: string } }).error.message, /эртага/);
    expect((await order({ phone: '+998 90 312 45 66' }, { ip: '203.0.113.5' })).status).toBe(201);
    expect(leadMessages().at(-2)!.text).toMatch(/бугун 3 та рақам/);
  });

  it('allows one IP at most 3 attempts an hour, failed ones included', async () => {
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await order({ turnstileToken: 'bad', phone: `+998 90 312 45 ${10 + i}` })).status);
    expect(statuses).toEqual([201, 201, 201, 429, 429]); // unchecked orders still count toward the limit
    // A real customer on another network is unaffected.
    expect((await order({}, { ip: '203.0.113.50' })).status).toBe(201);
  });

  it('refuses the 4th order from one IP within an hour', async () => {
    const statuses = [];
    for (const n of ['71', '72', '73']) statuses.push((await order({ phone: `+998 90 312 45 ${n}` })).status);
    const fourth = await order({ phone: '+998 90 312 45 74' });
    expect([...statuses, fourth.status]).toEqual([201, 201, 201, 429]);
    expectCallHint(((await fourth.json()) as { error: { message: string } }).error.message, /бироздан сўнг/);
    expect(leadMessages()).toHaveLength(3);
  });

  it('never loses an order to a failed security check: it arrives marked ⚠️ instead', async () => {
    const cases: Array<[string | undefined, string, string]> = [
      ['bad', '198.51.100.7', '+998 90 312 45 21'],
      ['other-site', '198.51.100.8', '+998 90 312 45 22'],
      ['other-form', '198.51.100.9', '+998 90 312 45 23'],
      [undefined, '198.51.100.10', '+998 90 312 45 24'], // the widget never loaded
    ];
    for (const [token, ip, phone] of cases) expect((await order({ turnstileToken: token, phone }, { ip })).status).toBe(201);
    expect(leadMessages()).toHaveLength(4);
    expect(leadMessages().every((m) => m.text.includes('«бот эмасман» текшируви ўтмади'))).toBe(true);
    // A passed check carries no such mark.
    await order({ phone: '+998 90 312 45 25' }, { ip: '198.51.100.11' });
    expect(leadMessages().at(-1)!.text).not.toContain('текшируви ўтмади');
  });

  it('warns the group once when the Turnstile secret is wrong', async () => {
    await order({ turnstileToken: 'wrong-secret' });
    await order({ turnstileToken: 'wrong-secret' }, { ip: '198.51.100.11' });
    await new Promise((r) => setTimeout(r, 200));
    const alerts = telegram.messages.filter((m) => m.text.includes('Сайт созламасида хато'));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.text).toContain('TURNSTILE_SECRET_KEY');
  });

  it('refuses posts from other websites and malformed bodies', async () => {
    expect((await order({}, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await order({ phone: '123' })).status).toBe(400);
    expect((await order({ isAdmin: true })).status).toBe(400);
    expect((await order({ submissionId: 'not-a-uuid' })).status).toBe(400);
    expect((await order({ fullName: 'x'.repeat(9000) })).status).toBe(413);
    const bad = await order({ phone: '123' });
    expect(((await bad.json()) as { error: { fields: Record<string, string> } }).error.fields.phone).toMatch(/нотўғри/);
  });
});

describe('configuration', () => {
  it('refuses orders instead of losing them when Telegram is not configured', async () => {
    await mf.dispose();
    mf = start({ TELEGRAM_BOT_TOKEN: '' });
    expect((await order()).status).toBe(503);
  });

  it('reports which settings exist without revealing them', async () => {
    const body = await (await mf.dispatchFetch(`${SITE}/api/health`)).text();
    expect(JSON.parse(body)).toMatchObject({ ok: true, turnstileSecret: true, telegram: true, waitingForTelegram: 0, meta: false });
    expect(body).not.toContain('test-token');
  });

  it('serves the website for every other path', async () => {
    expect(await (await mf.dispatchFetch(`${SITE}/`)).text()).toContain('<title>site</title>');
    expect((await mf.dispatchFetch(`${SITE}/api/nothing`)).status).toBe(404);
  });
});

/**
 * What the ads are taught, and when. The old behaviour reported every filled-in form, and on
 * this product most of them were people after free advice and children pressing buttons — so
 * Meta learned to find more of them. Nothing goes to Meta now until an operator has rung the
 * customer and said what happened.
 */
describe('the Lead event sent to Meta once an operator confirms the order', () => {
  const PIXEL = '1109358048693673';
  const withMeta = (extra: Record<string, string> = {}) =>
    start({ META_PIXEL_ID: PIXEL, META_CAPI_TOKEN: 'EAA-test-token', META_API_BASE: 'https://graph.mock', ...extra });

  const secret = async () => {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('zeynara-webhook:123456:test-token'));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  const hook = async (update: unknown) =>
    mf.dispatchFetch(`${SITE}/api/telegram/hook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': await secret() },
      body: JSON.stringify({ update_id: 1, ...(update as object) }),
    });
  /** An operator pressing a button under an order in the group. */
  const press = (data: string) =>
    hook({
      callback_query: {
        id: `cb${Math.random()}`,
        from: { id: 11, first_name: 'Ойша' },
        data,
        message: { message_id: 1001, chat: { id: Number(CHAT) }, text: '🆕 Янги буюртма\n👤 Ойша Тошева' },
      },
    });

  /** The event leaves after the operator's answer (waitUntil), so give it a moment. */
  const settled = async (n = 1) => {
    for (let i = 0; i < 50 && meta.events.length < n; i++) await new Promise((r) => setTimeout(r, 10));
    return meta.events;
  };
  /** Proof that nothing was sent: waiting the same time an event would have needed. */
  const quiet = async () => {
    await new Promise((r) => setTimeout(r, 150));
    return meta.events;
  };

  beforeEach(async () => {
    await mf.dispose();
    mf = withMeta();
  });

  it('stays off unless both the pixel id and the token are set', async () => {
    const half: Array<Record<string, string>> = [{}, { META_PIXEL_ID: PIXEL }, { META_CAPI_TOKEN: 'EAA-test-token' }];
    for (const bindings of half) {
      await mf.dispose();
      mf = start({ META_API_BASE: 'https://graph.mock', ...bindings });
      expect((await order()).status).toBe(201);
      await press('s:1:sold');
      expect(await quiet()).toHaveLength(0);
      expect(await (await mf.dispatchFetch(`${SITE}/api/health`)).json()).toMatchObject({ meta: false });
    }
  });

  it('says in the health check that reporting is on, so a missing secret is visible after deploying', async () => {
    expect(await (await mf.dispatchFetch(`${SITE}/api/health`)).json()).toMatchObject({ meta: true });
  });

  it('tells Meta nothing when the order arrives: a filled-in form is not a customer yet', async () => {
    expect((await order()).status).toBe(201);
    expect(leadMessages()).toHaveLength(1); // the operators hear about it immediately
    expect(await quiet()).toHaveLength(0); // Meta does not
  });

  it('never invites the browser to report the order, so one order cannot become two events', async () => {
    expect(await (await order()).json()).not.toHaveProperty('track');
    // Not even without credentials: an unqualified Lead is worse for the ads than no Lead.
    await mf.dispose();
    mf = start(); // no META_* secrets at all
    expect(await (await order()).json()).not.toHaveProperty('track');
  });

  it('sends one Lead when the sale is marked, keyed to the order the browser knows', async () => {
    const submissionId = sid();
    expect((await order({ submissionId })).status).toBe(201);
    await press('s:1:sold');
    const [event] = await settled();
    expect(event).toMatchObject({ event_name: 'Lead', action_source: 'website', event_id: submissionId });
    expect(meta.bodies[0]!.access_token).toBe('EAA-test-token');
    // One dataset, one event, and the token never travels in the URL.
    expect(meta.bodies).toHaveLength(1);
  });

  it('reports the moment the customer ordered, not the moment the operator pressed', async () => {
    const before = Math.floor(Date.now() / 1000);
    await order();
    const after = Math.floor(Date.now() / 1000); // the order may straddle a second boundary
    await new Promise((r) => setTimeout(r, 1100)); // the operator calls back later
    await press('s:1:sold');
    const [event] = await settled();
    expect(event!.event_time).toBeGreaterThanOrEqual(before);
    expect(event!.event_time).toBeLessThanOrEqual(after);
  });

  it('reports a customer who said no: a real person, which is what the ads must look for', async () => {
    await order();
    await press('s:1:rejected');
    expect(await settled()).toHaveLength(1);
  });

  it('never reports an order marked spam — that is the whole point', async () => {
    await order();
    await press('s:1:spam');
    expect(await quiet()).toHaveLength(0);
  });

  it('keeps an unanswered order waiting, and reports it when the call finally connects', async () => {
    await order();
    await press('s:1:noanswer');
    expect(await quiet()).toHaveLength(0);
    await press('s:1:sold');
    expect(await settled()).toHaveLength(1);
  });

  it('keeps a "ring me later" order waiting: the customer answered but has not decided', async () => {
    await order();
    await press('s:1:callback');
    expect(await quiet()).toHaveLength(0);
    await press('s:1:sold');
    expect(await settled()).toHaveLength(1);
  });

  it('sends a Purchase beside the Lead when a sold order has a value, under its own event id', async () => {
    await mf.dispose();
    mf = withMeta({ META_ORDER_VALUE: '349000' });
    const submissionId = sid();
    await order({ submissionId });
    await press('s:1:sold');
    const events = await settled(2);
    expect(events).toHaveLength(2);
    const purchase = events.find((e) => e.event_name === 'Purchase')!;
    expect(purchase.event_id).toBe(`${submissionId}-purchase`);
    expect(purchase.custom_data).toMatchObject({ value: 349000, currency: 'UZS' });
    // The Lead is still the plain submission id, so the browser copy could never double it.
    expect(events.find((e) => e.event_name === 'Lead')!.event_id).toBe(submissionId);
  });

  it('sends no Purchase for a customer who said no — answering the phone is not buying', async () => {
    await mf.dispose();
    mf = withMeta({ META_ORDER_VALUE: '349000' });
    await order();
    await press('s:1:rejected');
    expect((await quiet()).map((e) => e.event_name)).toEqual(['Lead']);
  });

  it('sends no Purchase at all without a value: a made-up figure is worse than none', async () => {
    await order();
    await press('s:1:sold');
    expect((await quiet()).map((e) => e.event_name)).toEqual(['Lead']);
  });

  it('reports an order once, however many times the buttons are pressed', async () => {
    await order();
    await press('s:1:sold');
    await settled();
    await press('s:1:rejected');
    await press('r:1');
    await press('s:1:sold');
    expect(await quiet()).toHaveLength(1);
  });

  it('reports an order whose security check never finished, once an operator vouches for it', async () => {
    // Turnstile not finishing is normal on old phones and in in-app browsers; the operator
    // who spoke to the customer is a better judge of a real person than the widget.
    await order({ turnstileToken: 'bad' });
    expect(leadMessages()[0]!.text).toContain('«бот эмасман» текшируви ўтмади');
    await press('s:1:sold');
    expect(await settled()).toHaveLength(1);
  });

  it('identifies the customer only by one-way hashes, never the number itself', async () => {
    await order({ fullName: 'Ойша Тошева', phone: '+998 90 312 45 67' });
    await press('s:1:sold');
    const [event] = await settled();
    const sent = JSON.stringify(event);
    expect(sent).not.toContain('998903124567');
    expect(sent).not.toContain('Ойша');
    // SHA-256 of "998903124567" and of "ойша" — what Meta matches on.
    expect(event!.user_data.ph).toMatch(/^[0-9a-f]{64}$/);
    expect(event!.user_data.fn).toMatch(/^[0-9a-f]{64}$/);
    expect(event!.user_data.ln).toMatch(/^[0-9a-f]{64}$/);
    expect(event!.user_data.ph).toBe(await sha256('998903124567'));
    expect(event!.user_data.fn).toBe(await sha256('ойша'));
  });

  it('keeps the visitor details from the order itself, not from the operator pressing a button', async () => {
    await order(
      {},
      {
        ip: '203.0.113.77',
        userAgent: 'Mozilla/5.0 (iPhone) Instagram',
        cookie: '_ga=GA1.1.x; _fbp=fb.1.1760000000000.1234567890; _fbc=fb.1.1760000000000.IwAR-click-id',
      },
    );
    await press('s:1:sold');
    const [event] = await settled();
    expect(event!.user_data).toMatchObject({
      client_ip_address: '203.0.113.77',
      client_user_agent: 'Mozilla/5.0 (iPhone) Instagram',
      fbp: 'fb.1.1760000000000.1234567890',
      fbc: 'fb.1.1760000000000.IwAR-click-id',
    });
  });

  it('does not count a repeat of the same number as a second Lead', async () => {
    await order({ phone: '+998 90 312 45 68' });
    const repeat = await order({ phone: '+998 90 312 45 68' });
    expect(await repeat.json()).toMatchObject({ status: 'duplicate' });
    await press('s:1:sold');
    expect(await settled()).toHaveLength(1);
    expect(await quiet()).toHaveLength(1);
  });

  it('saves the outcome and keeps the group in step even when Meta is unreachable', async () => {
    await mf.dispose();
    mf = withMeta({ META_API_BASE: 'https://graph-down.mock' });
    expect((await order()).status).toBe(201);
    await press('s:1:sold');
    await new Promise((r) => setTimeout(r, 150));
    const edit = telegram.calls.filter((c) => c.method === 'editMessageText').at(-1)!.body as { text: string };
    expect(edit.text).toMatch(/✅ Сотилди — Ойша/);
  });

  it('counts the orders nobody has marked in the daily report, since the ads ignore those', async () => {
    await order({ phone: '+998 90 312 45 81' }, { ip: '203.0.113.81' });
    await order({ phone: '+998 90 312 45 82' }, { ip: '203.0.113.82' });
    await press('s:1:sold');
    await settled();
    await hook({ message: { message_id: 9, chat: { id: Number(CHAT), type: 'supergroup' }, text: '/hisobot' } });
    expect(telegram.messages.at(-1)!.text).toContain('📣 Натижаси белгиланмаган: 1 та');
  });
});

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('the partner site (sites.ts t2)', () => {
  const PARTNER_SITE = 'https://zeynaraa-uz.example';
  const MAIN_PIXEL = '1109358048693673';
  const PARTNER_PIXEL = '1783794022832394';

  beforeEach(async () => {
    await mf.dispose();
    mf = start({
      META_PIXEL_ID: MAIN_PIXEL,
      META_CAPI_TOKEN: 'EAA-main',
      META_T2_PIXEL_ID: PARTNER_PIXEL,
      META_T2_CAPI_TOKEN: 'EAA-partner',
      META_API_BASE: 'https://graph.mock',
      SHEETS_T2_URL: 'https://sheets.mock/exec',
      SHEETS_T2_SECRET: 'sheet-secret',
    });
  });

  /** The Pages function forwards the customer's request unchanged over the service binding. */
  async function partner(path: string, init: RequestInit = {}) {
    const { PARTNER } = await mf.getBindings<{ PARTNER: { fetch(url: string, init?: RequestInit): Promise<Response> } }>();
    return PARTNER.fetch(`${PARTNER_SITE}${path}`, init);
  }
  const partnerOrder = (body: Record<string, unknown>, ip: string) =>
    partner('/api/leads', {
      method: 'POST',
      // No Origin: Miniflare's binding proxy refuses any request carrying one. The origin check
      // itself is the same code as the main site's and is tested there.
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
      body: JSON.stringify({ submissionId: sid(), turnstileToken: 'partner', ...body }),
    });

  const secret = async () => {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('zeynara-webhook:123456:test-token'));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  const press = async (data: string) =>
    mf.dispatchFetch(`${SITE}/api/telegram/hook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': await secret() },
      body: JSON.stringify({
        update_id: 1,
        callback_query: { id: `cb${Math.random()}`, from: { id: 11, first_name: 'Ойша' }, data, message: { message_id: 1001, chat: { id: Number(CHAT) }, text: '🆕' } },
      }),
    });
  /** Rows and events leave after the answer (waitUntil), so give them a moment. */
  const until = async (done: () => boolean) => {
    for (let i = 0; i < 50 && !done(); i++) await new Promise((r) => setTimeout(r, 10));
  };

  it('go to its sheet alone, with the phone number, and never to the operators’ group', async () => {
    const res = await partnerOrder(
      { fullName: 'Дилноза Каримова', phone: '+998 90 312 45 80', utm: { source: 'facebook', campaign: 'qon-bosimi', term: 'A', content: 'Video 1' } },
      '203.0.113.80',
    );
    expect(res.status).toBe(201);
    await until(() => sheets.rows.length >= 1);
    expect(sheets.rows[0]).toMatchObject({ secret: 'sheet-secret', sheet: 'Lidlar' });
    expect(sheets.rows[0]!.headers.slice(0, 4)).toEqual(['№', 'Sana', 'Ism', 'Telefon']);
    const [number, , name, phone, campaign, adset, ad, flags] = sheets.rows[0]!.row;
    expect([number, name, phone, campaign, adset, ad, flags]).toEqual([1, 'Дилноза Каримова', "'+998 90 312 45 80", 'qon-bosimi', 'A', 'Video 1', '']);
    await new Promise((r) => setTimeout(r, 100));
    // Not in the group, not in the lists, and the bot's webhook is left alone.
    expect(telegram.messages).toHaveLength(0);
    expect(telegram.calls.some((c) => c.method === 'setWebhook')).toBe(false);
  });

  it('numbers its own orders, and is no repeat of a main-site order', async () => {
    expect((await order({ phone: '+998 90 312 45 81' }, { ip: '203.0.113.81' })).status).toBe(201);
    // The same customer on the partner site: theirs, not a repeat of ours.
    expect(await (await partnerOrder({ fullName: 'Бир Киши', phone: '+998 90 312 45 81' }, '203.0.113.82')).json()).toMatchObject({ status: 'accepted' });
    expect(await (await partnerOrder({ fullName: 'Бир Киши', phone: '+998 90 312 45 81' }, '203.0.113.82')).json()).toMatchObject({ status: 'duplicate' });
    expect(await (await partnerOrder({ fullName: 'Икки Киши', phone: '+998 90 312 45 83' }, '203.0.113.83')).json()).toMatchObject({ status: 'accepted' });
    await until(() => sheets.rows.length >= 2);
    await new Promise((r) => setTimeout(r, 100));
    expect(sheets.rows.map((r) => [r.row[0], r.row[2]])).toEqual([
      [1, 'Бир Киши'],
      [2, 'Икки Киши'],
    ]);
    expect(leadMessages()).toHaveLength(1); // only the main site's order
  });

  it("sends its Lead to the partner's dataset at once; the main site's waits for the operator, to ours", async () => {
    expect((await partnerOrder({ fullName: 'Бир Киши', phone: '+998 90 312 45 85' }, '203.0.113.85')).status).toBe(201);
    await until(() => meta.bodies.length >= 1);
    expect(meta.paths).toEqual([`/v21.0/${PARTNER_PIXEL}/events`]);
    expect(meta.bodies[0]).toMatchObject({ access_token: 'EAA-partner', data: [{ event_name: 'Lead' }] });

    expect((await order({ phone: '+998 90 312 45 84' }, { ip: '203.0.113.84' })).status).toBe(201);
    await new Promise((r) => setTimeout(r, 100));
    expect(meta.bodies).toHaveLength(1);
    await press('s:1:sold');
    await until(() => meta.bodies.length >= 2);
    expect(meta.paths[1]).toBe(`/v21.0/${MAIN_PIXEL}/events`);
    expect(meta.bodies[1]!.access_token).toBe('EAA-main');
  });

  it('reads «Keraksiz» from its sheet as spam: the device is flagged on the next order, on either site', async () => {
    const DEVICE = '11111111-2222-4333-8444-555555555555';
    const readSheet = async () => {
      const worker = (await mf.getWorker()) as unknown as { scheduled(o: { cron: string }): Promise<unknown> };
      await worker.scheduled({ cron: '*/5 * * * *' });
    };
    expect((await partnerOrder({ fullName: 'Ёлғон Исм', phone: '+998 90 312 45 86', deviceId: DEVICE }, '203.0.113.86')).status).toBe(201);
    await until(() => meta.bodies.length >= 1);

    // Their own dropdown's spelling; a header-less or blank row is skipped.
    sheets.statuses = [[1, 'keraksiz '], ['', 'Keraksiz'], [99, 'Spam']];
    await readSheet();

    // Same phone, another network: flagged in the sheet, and the ads are not told.
    expect((await partnerOrder({ fullName: 'Бошқа Исм', phone: '+998 90 312 45 87', deviceId: DEVICE }, '198.51.100.87')).status).toBe(201);
    await until(() => sheets.rows.length >= 2);
    expect(sheets.rows[1]!.row[7]).toBe('bu qurilmadan avval spam belgilangan');
    await new Promise((r) => setTimeout(r, 100));
    expect(meta.bodies).toHaveLength(1);
    // The operators see it too, on the main site.
    expect((await order({ phone: '+998 90 312 45 88', deviceId: DEVICE }, { ip: '192.0.2.88' })).status).toBe(201);
    expect(leadMessages().at(-1)!.text).toContain('бу қурилмадан аввал спам белгиланган');

    // Picked something else after all: forgotten at the next read.
    sheets.statuses = [[1, 'Kerakli']];
    await readSheet();
    expect((await partnerOrder({ fullName: 'Учинчи Исм', phone: '+998 90 312 45 89', deviceId: DEVICE }, '192.0.2.89')).status).toBe(201);
    await until(() => sheets.rows.length >= 3);
    expect(sheets.rows[2]!.row[7]).toBe('');
  });

  it("an operator's 🚫 marks the device: its next order is flagged even from another network", async () => {
    const DEVICE = '66666666-7777-4888-9999-000000000000';
    expect((await order({ phone: '+998 90 312 45 90', deviceId: DEVICE }, { ip: '203.0.113.90' })).status).toBe(201);
    await press('s:1:spam');
    expect((await order({ phone: '+998 90 312 45 91', deviceId: DEVICE }, { ip: '198.51.100.91' })).status).toBe(201);
    expect(leadMessages().at(-1)!.text).toContain('бу қурилмадан аввал спам белгиланган');
    expect(leadMessages().at(-1)!.text).not.toContain('бу манбадан аввал спам');
    // Another phone on that first network: only the network warning.
    expect((await order({ phone: '+998 90 312 45 92', deviceId: '12345678-1234-4234-8234-123456789012' }, { ip: '203.0.113.90' })).status).toBe(201);
    expect(leadMessages().at(-1)!.text).toContain('бу манбадан аввал спам белгиланган');
    expect(leadMessages().at(-1)!.text).not.toContain('қурилмадан');
  });

  it('a phone that looks like a marked one is flagged after its browser data is cleared, on either site', async () => {
    const LOOKS = 'ab'.repeat(32);
    const device = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
    expect((await order({ phone: '+998 90 312 45 93', deviceId: device(1), fingerprint: LOOKS }, { ip: '203.0.113.93' })).status).toBe(201);
    await press('s:1:spam');

    // Cleared data (a new device id), the same likeness, another network: a hint, not a refusal.
    expect((await order({ phone: '+998 90 312 45 94', deviceId: device(2), fingerprint: LOOKS }, { ip: '198.51.100.94' })).status).toBe(201);
    expect(leadMessages().at(-1)!.text).toContain('аввал спам бўлган қурилмага ўхшайди');
    expect(leadMessages().at(-1)!.text).not.toContain('бу қурилмадан');
    // The same device still gets the stronger warning only.
    expect((await order({ phone: '+998 90 312 45 95', deviceId: device(1), fingerprint: LOOKS }, { ip: '192.0.2.95' })).status).toBe(201);
    expect(leadMessages().at(-1)!.text).toContain('бу қурилмадан аввал спам белгиланган');
    expect(leadMessages().at(-1)!.text).not.toContain('ўхшайди');
    // Another phone altogether: nothing.
    expect((await order({ phone: '+998 90 312 45 96', deviceId: device(3), fingerprint: 'cd'.repeat(32) }, { ip: '192.0.2.96' })).status).toBe(201);
    expect(leadMessages().at(-1)!.text).not.toContain('спам');
    // On the partner site too, in its sheet.
    expect((await partnerOrder({ fullName: 'Ўхшаш Исм', phone: '+998 90 312 45 97', deviceId: device(4), fingerprint: LOOKS }, '192.0.2.97')).status).toBe(201);
    await until(() => sheets.rows.length >= 1);
    expect(sheets.rows[0]!.row[7]).toBe("avval spam bo'lgan qurilmaga o'xshaydi");
  });

  it('opens nothing but the order form to the partner site', async () => {
    expect((await partner('/api/panel/data')).status).toBe(404);
    expect((await partner('/api/health')).status).toBe(404);
    expect((await partner('/api/leads')).status).toBe(405);
    expect((await partner('/api/sheet', { method: 'POST' })).status).toBe(404);
  });
});

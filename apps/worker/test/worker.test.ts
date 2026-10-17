import { build } from 'esbuild';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
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
};
let turnstileCalls = 0;

/** Fake Meta Graph API: the Conversions API bodies and the events inside them. */
const meta = {
  bodies: [] as Array<{ access_token: string; test_event_code?: string; data: Array<Record<string, any>> }>,
  events: [] as Array<Record<string, any>>,
};

async function outbound(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.hostname === 'graph.mock') {
    const body = (await request.json()) as { access_token: string; data: Array<Record<string, any>> };
    meta.bodies.push(body);
    meta.events.push(...body.data);
    return Response.json({ events_received: body.data.length, fbtrace_id: 'test' });
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
      hostname: token === 'other-site' ? 'evil.example' : 'zeynara.example',
    });
  }
  if (url.hostname === 'telegram.mock') {
    if (telegram.down) return new Response('Bad Gateway', { status: 502 });
    const method = url.pathname.split('/').pop()!;
    if (method !== 'sendMessage') {
      telegram.calls.push({ method, body: await request.json() });
      if (method === 'getChat') return Response.json({ ok: true, result: { id: Number(CHAT), is_forum: telegram.forum } });
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
    modules: true,
    script,
    compatibilityDate: '2026-10-01',
    durableObjects: { REGISTRY: { className: 'LeadRegistry', useSQLite: true } },
    serviceBindings: { ASSETS: () => new Response('<!doctype html><title>site</title>') },
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
    entryPoints: [new URL('../src/index.ts', import.meta.url).pathname],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    conditions: ['workerd', 'worker', 'browser'],
    mainFields: ['module', 'main'],
    external: ['cloudflare:*'],
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
  turnstileCalls = 0;
  meta.bodies = [];
  meta.events = [];
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
    expect(edit.reply_markup.inline_keyboard.flat().map((b) => b.callback_data)).toEqual(['s:1:sold', 's:1:noanswer', 's:1:rejected', 'r:1']);
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
    expect(statuses).toEqual([403, 403, 403, 429, 429]);
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

  it('refuses failed, foreign-site and foreign-form Turnstile tokens', async () => {
    expect((await order({ turnstileToken: 'bad' })).status).toBe(403);
    expect((await order({ turnstileToken: 'other-site' }, { ip: '198.51.100.8' })).status).toBe(403);
    expect((await order({ turnstileToken: 'other-form' }, { ip: '198.51.100.9' })).status).toBe(403);
    expect((await order({ turnstileToken: undefined }, { ip: '198.51.100.10' })).status).toBe(403);
    expect(leadMessages()).toHaveLength(0);
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
    expect(JSON.parse(body)).toMatchObject({ ok: true, turnstileSecret: true, telegram: true, waitingForTelegram: 0 });
    expect(body).not.toContain('test-token');
  });

  it('serves the website for every other path', async () => {
    expect(await (await mf.dispatchFetch(`${SITE}/`)).text()).toContain('<title>site</title>');
    expect((await mf.dispatchFetch(`${SITE}/api/nothing`)).status).toBe(404);
  });
});

describe('the Lead event sent to Meta from the server', () => {
  const PIXEL = '1109358048693673';
  const withMeta = (extra: Record<string, string> = {}) =>
    start({ META_PIXEL_ID: PIXEL, META_CAPI_TOKEN: 'EAA-test-token', META_API_BASE: 'https://graph.mock', ...extra });

  /** The event leaves after the customer's answer (ctx.waitUntil), so give it a moment. */
  const settled = async (n = 1) => {
    for (let i = 0; i < 50 && meta.events.length < n; i++) await new Promise((r) => setTimeout(r, 10));
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
      await new Promise((r) => setTimeout(r, 50));
      expect(meta.events).toHaveLength(0);
    }
  });

  it('sends one Lead for a new order, keyed to the same id the browser pixel uses', async () => {
    const submissionId = sid();
    expect((await order({ submissionId })).status).toBe(201);
    const [event] = await settled();
    expect(event).toMatchObject({ event_name: 'Lead', action_source: 'website', event_id: submissionId });
    expect(event!.event_time).toBeCloseTo(Math.floor(Date.now() / 1000), -1);
    expect(meta.bodies[0]!.access_token).toBe('EAA-test-token');
    // Sent to the right dataset, and the token never travels in the URL.
    expect(meta.bodies).toHaveLength(1);
  });

  it('identifies the customer only by one-way hashes, never the number itself', async () => {
    await order({ fullName: 'Ойша Тошева', phone: '+998 90 312 45 67' });
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

  it('passes on the Meta cookies and the visitor details that make the match work', async () => {
    await order(
      {},
      {
        ip: '203.0.113.77',
        userAgent: 'Mozilla/5.0 (iPhone) Instagram',
        cookie: '_ga=GA1.1.x; _fbp=fb.1.1760000000000.1234567890; _fbc=fb.1.1760000000000.IwAR-click-id',
      },
    );
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
    await settled();
    const repeat = await order({ phone: '+998 90 312 45 68' });
    expect(await repeat.json()).toMatchObject({ status: 'duplicate' });
    await new Promise((r) => setTimeout(r, 50));
    expect(meta.events).toHaveLength(1);
  });

  it('still accepts the order when Meta is unreachable', async () => {
    await mf.dispose();
    mf = withMeta({ META_API_BASE: 'https://graph-down.mock' });
    const res = await order();
    expect(res.status).toBe(201);
    expect(leadMessages()).toHaveLength(1);
  });
});

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

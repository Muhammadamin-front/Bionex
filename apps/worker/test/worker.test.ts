import { build } from 'esbuild';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { site } from '../../web/src/config/product';

/**
 * Runs the real Worker in workerd (the Cloudflare runtime) with its Durable Object.
 * Telegram and Turnstile are replaced by fakes that record what they receive.
 */

const SITE = 'https://zeynara.example';
const CHAT = '-1001234567890';
let script = '';
let mf: Miniflare;

/** Fake Telegram: every sendMessage body; `down` makes it fail like an outage. */
const telegram = { messages: [] as Array<{ chat_id: string; text: string; reply_parameters?: { message_id: number } }>, down: false };
let turnstileCalls = 0;

async function outbound(request: Request): Promise<Response> {
  const url = new URL(request.url);
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

function order(body: Record<string, unknown> = {}, opts: { ip?: string; origin?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'cf-connecting-ip': opts.ip ?? '198.51.100.7' };
  if (opts.origin !== null) headers.origin = opts.origin ?? SITE;
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
  telegram.down = false;
  turnstileCalls = 0;
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
    expect(msg.text).toContain('facebook / kuz');
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

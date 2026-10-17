import { NAME_MESSAGES, PHONE_MESSAGES } from '@bionex/shared/lead';
import { normalizeName } from '@bionex/shared/name';
import { formatUzPhone, normalizeUzPhone } from '@bionex/shared/phone';
import { DurableObject } from 'cloudflare:workers';
import { askName, askPhone, BOT_TEXT, done, testNotice, welcome, type BotReply } from './bot';
import {
  callTelegram,
  formatLead,
  batchTitle,
  formatList,
  formatListStatus,
  formatRepeat,
  formatReport,
  formatStatus,
  operatorLine,
  sendTelegram,
  takeKeyboard,
  TelegramError,
  todayTitle,
  webhookSecret,
  type InlineKeyboard,
  type LeadOutcome,
  type ListItem,
  type TelegramConfig,
} from './telegram';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Order attempts per phone number per hour, on top of Turnstile and the per-IP limit. */
const PHONE_REQUESTS_PER_HOUR = 5;
/** Orders that Telegram never accepted are given up (and logged) after this long. */
const GIVE_UP_AFTER = 7 * DAY;
/** Bump when the webhook needs new update types or commands. */
const WEBHOOK_VERSION = 'v4';

/** Midnight in Tashkent (UTC+5, no daylight saving) for the day containing `now`. */
function tashkentDayStart(now: number): number {
  const tz = 5 * HOUR;
  return Math.floor((now + tz) / DAY) * DAY - tz;
}

export type CheckResult = { kind: 'go' } | { kind: 'replay'; status: 'accepted' | 'duplicate' } | { kind: 'limited' };
export type AcceptResult = { status: 'accepted' | 'duplicate' | 'ip_limited'; number?: number };

/** Where a group message goes when the group uses topics. */
type Thread = 'leads' | 'reports' | number | undefined;

/** One update from a customer's private chat with the bot. */
export interface BotInput {
  userId: number;
  firstName: string;
  text?: string;
  /** A shared contact; `ownerId` is whose number it is (Telegram fills it for "share my number"). */
  contact?: { phone: string; ownerId?: number };
  now: number;
}

/** What a button press under an order changed (the Worker then edits the message). */
export type ButtonResult =
  | { changed: false; toast: string }
  | { changed: true; toast: string; line: string | null; keyboard: 'take' | 'outcome' };

export interface OrderInput {
  submissionId: string;
  ip: string;
  /** E.164. */
  phone: string;
  fullName: string;
  utm: Record<string, string | undefined>;
  flags: string[];
  now: number;
  /** Ordered through the Telegram bot (the number shared as a contact, or typed). */
  via?: 'bot-contact' | 'bot-typed';
}

/**
 * The one place that remembers recent orders, as a single SQLite-backed Durable Object.
 *
 * One instance handles every order one at a time, so two simultaneous submissions of the
 * same number can never both become "new" (no race), and its storage is durable: an order
 * is answered "accepted" only once it is written here. Messages to Telegram go through a
 * small outbox, retried by an alarm if Telegram is down, so no order is lost.
 *
 * Privacy: phone numbers and IPs are kept only as keyed hashes (secret generated here and
 * never leaves this object). A name and number are stored in clear only inside a message
 * still waiting for Telegram, and for 7 days in list_items for the operators' /royxat.
 */
export class LeadRegistry extends DurableObject<Env> {
  private readonly sql: SqlStorage;
  private secret: CryptoKey | null = null;
  /** A webhook setup already running: simultaneous requests wait for it instead of repeating it. */
  private webhookJob: Promise<void> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, status TEXT NOT NULL, at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_hash TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        at INTEGER NOT NULL,
        repeats INTEGER NOT NULL DEFAULT 1,
        message_id INTEGER
      );
      CREATE INDEX IF NOT EXISTS leads_phone ON leads (phone_hash, at);
      CREATE INDEX IF NOT EXISTS leads_ip ON leads (ip_hash, at);
      CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        lead_id INTEGER,
        reply_to_lead INTEGER,
        created INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_try INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS hits (key TEXT NOT NULL, at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS hits_key ON hits (key, at);
      CREATE TABLE IF NOT EXISTS alerts (kind TEXT PRIMARY KEY, at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS list_items (
        lead_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        at INTEGER NOT NULL,
        flagged INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS lead_status (
        lead_id INTEGER PRIMARY KEY,
        created_at INTEGER NOT NULL,
        taker_id INTEGER,
        taker_name TEXT,
        taken_at INTEGER,
        outcome TEXT,
        outcome_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS lead_status_created ON lead_status (created_at);
      CREATE TABLE IF NOT EXISTS bot_sessions (
        user_id INTEGER PRIMARY KEY,
        step TEXT NOT NULL,
        phone TEXT,
        verified INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );
    `);
    // Added after launch: the topic a queued message goes to (live data already exists).
    const outboxColumns = this.sql.exec<{ name: string }>('PRAGMA table_info(outbox)').toArray().map((c) => c.name);
    if (!outboxColumns.includes('thread_id')) this.sql.exec('ALTER TABLE outbox ADD COLUMN thread_id INTEGER');
    const sessionColumns = this.sql.exec<{ name: string }>('PRAGMA table_info(bot_sessions)').toArray().map((c) => c.name);
    if (!sessionColumns.includes('test')) this.sql.exec('ALTER TABLE bot_sessions ADD COLUMN test INTEGER NOT NULL DEFAULT 0');
    // Orders now stay listable after their 10-order list went out (for /royxat): mark, don't delete.
    const listColumns = this.sql.exec<{ name: string }>('PRAGMA table_info(list_items)').toArray().map((c) => c.name);
    if (!listColumns.includes('listed')) this.sql.exec('ALTER TABLE list_items ADD COLUMN listed INTEGER NOT NULL DEFAULT 0');
  }

  /** Before Turnstile: an already-answered attempt gets its answer again; floods are cut off. */
  async check(input: { submissionId: string; ip: string; phone: string; now: number }): Promise<CheckResult> {
    const prior = this.sql.exec<{ status: 'accepted' | 'duplicate' }>('SELECT status FROM submissions WHERE id = ?', input.submissionId).toArray()[0];
    if (prior) return { kind: 'replay', status: prior.status };
    const ipKey = `ip:${await this.hash(input.ip)}`;
    const phoneKey = `phone:${await this.hash(input.phone)}`;
    const count = (key: string, since: number) =>
      this.sql.exec<{ n: number }>('SELECT count(*) AS n FROM hits WHERE key = ? AND at > ?', key, since).one().n;
    this.sql.exec('INSERT INTO hits (key, at) VALUES (?, ?), (?, ?)', ipKey, input.now, phoneKey, input.now);
    // Every attempt counts, failed ones too: a competitor's script gets a few tries an hour, not hundreds.
    if (count(ipKey, input.now - HOUR) > Number(this.env.IP_ORDERS_PER_HOUR || 3)) return { kind: 'limited' };
    if (count(phoneKey, input.now - HOUR) > PHONE_REQUESTS_PER_HOUR) return { kind: 'limited' };
    return { kind: 'go' };
  }

  /** After Turnstile passed: decide new / repeat / refused, record it, and queue the Telegram message. */
  async accept(input: OrderInput): Promise<AcceptResult> {
    const phoneHash = await this.hash(input.phone);
    const ipHash = await this.hash(input.ip);
    const { now } = input;

    // Everything below runs without awaiting, so no other order can interleave with it.
    const prior = this.sql.exec<{ status: 'accepted' | 'duplicate' }>('SELECT status FROM submissions WHERE id = ?', input.submissionId).toArray()[0];
    if (prior) return { status: prior.status };

    const windowMs = Number(this.env.DUPLICATE_WINDOW_HOURS || 24) * HOUR;
    const earlier = this.sql
      .exec<{ id: number; repeats: number }>('SELECT id, repeats FROM leads WHERE phone_hash = ? AND at > ? ORDER BY at DESC LIMIT 1', phoneHash, now - windowMs)
      .toArray()[0];
    if (earlier) {
      // The same customer again (impatient, or pressed twice): one order, and a nudge to the operators.
      const repeats = earlier.repeats + 1;
      this.sql.exec('UPDATE leads SET repeats = ? WHERE id = ?', repeats, earlier.id);
      if (repeats <= 5) this.enqueue(formatRepeat(input.phone, repeats, now), { replyToLead: earlier.id, now, thread: 'leads' });
      this.sql.exec('INSERT INTO submissions (id, status, at) VALUES (?, ?, ?)', input.submissionId, 'duplicate', now);
      await this.flush();
      return { status: 'duplicate' };
    }

    // Someone typing strangers' numbers: one network may order for only a few numbers a day.
    const otherPhones = this.sql
      .exec<{ n: number }>('SELECT count(DISTINCT phone_hash) AS n FROM leads WHERE ip_hash = ? AND at > ?', ipHash, now - DAY)
      .one().n;
    if (otherPhones >= Number(this.env.LEADS_PER_IP_PER_DAY || 3)) return { status: 'ip_limited' };

    const leadId = this.sql
      .exec<{ id: number }>('INSERT INTO leads (phone_hash, ip_hash, at) VALUES (?, ?, ?) RETURNING id', phoneHash, ipHash, now)
      .one().id;
    this.sql.exec('INSERT INTO lead_status (lead_id, created_at) VALUES (?, ?)', leadId, now);
    const list = this.addToList(leadId, input, now);
    const text = formatLead({
      number: leadId,
      fullName: input.fullName,
      phone: input.phone,
      createdAt: now,
      utm: input.utm,
      source: { id: ipHash.slice(0, 6), phonesToday: otherPhones + 1 },
      flags: input.flags,
      list: list ? { count: list.count, size: list.size } : undefined,
      via: input.via,
    });
    // The order first, then (if it completed one) the list under it.
    this.enqueue(text, { leadId, now, thread: 'leads' });
    if (list?.full) this.sendList(now);
    this.sql.exec('INSERT INTO submissions (id, status, at) VALUES (?, ?, ?)', input.submissionId, 'accepted', now);
    this.prune(now);
    await this.flush();
    return { status: 'accepted', number: leadId };
  }

  /** A configuration problem that silently loses every order: tell the group, at most hourly. */
  async alert(kind: string, text: string, now: number): Promise<void> {
    const last = this.sql.exec<{ at: number }>('SELECT at FROM alerts WHERE kind = ?', kind).toArray()[0];
    if (last && now - last.at < HOUR) return;
    this.sql.exec('INSERT OR REPLACE INTO alerts (kind, at) VALUES (?, ?)', kind, now);
    this.enqueue(text, { now, thread: 'reports' });
    await this.flush();
  }

  /** Messages Telegram has not accepted yet (0 when all is well). */
  async queued(): Promise<number> {
    return this.sql.exec<{ n: number }>('SELECT count(*) AS n FROM outbox').one().n;
  }

  /** Retries messages that could not be delivered earlier. */
  override async alarm(): Promise<void> {
    await this.flush();
  }

  /**
   * Every LEADS_PER_LIST new orders (default 10), the group also gets them as one numbered
   * list, so operators can share out the calls. Each order is still sent the moment it
   * arrives; the list is only a summary. 0 turns the lists off.
   */
  private addToList(leadId: number, input: OrderInput, now: number): { count: number; size: number; full: boolean } | null {
    // Kept for /royxat even when the 10-order lists are turned off.
    this.sql.exec(
      'INSERT INTO list_items (lead_id, name, phone, at, flagged) VALUES (?, ?, ?, ?, ?)',
      leadId,
      input.fullName,
      input.phone,
      now,
      input.flags.length > 0 ? 1 : 0,
    );
    const size = this.listSize();
    if (size === 0) return null;
    const count = this.listCount();
    return { count, size, full: count >= size };
  }

  private listSize(): number {
    const size = Number(this.env.LEADS_PER_LIST ?? 10);
    return size > 0 ? size : 0;
  }

  /** Orders since the last 10-order list. */
  private listCount(): number {
    return this.sql.exec<{ n: number }>('SELECT count(*) AS n FROM list_items WHERE listed = 0').one().n;
  }

  /** Orders with their current status (who took it, the outcome), oldest first. */
  private listItems(where: string, ...params: Array<number | string>): ListItem[] {
    return this.sql
      .exec<{ lead_id: number; name: string; phone: string; at: number; flagged: number; taker_name: string | null; outcome: string | null }>(
        `SELECT li.lead_id, li.name, li.phone, li.at, li.flagged, ls.taker_name, ls.outcome
           FROM list_items li LEFT JOIN lead_status ls ON ls.lead_id = li.lead_id
          WHERE ${where} ORDER BY li.lead_id`,
        ...params,
      )
      .toArray()
      .map((i) => ({
        number: i.lead_id,
        fullName: i.name,
        phone: i.phone,
        createdAt: i.at,
        flagged: i.flagged === 1,
        takerName: i.taker_name,
        outcome: i.outcome as LeadOutcome | null,
      }));
  }

  /** Every LEADS_PER_LIST new orders: queue them as one list, and mark them as sent. */
  private sendList(now: number): void {
    const items = this.listItems('li.listed = 0').slice(0, this.listSize());
    if (items.length === 0) return;
    for (const text of formatList(batchTitle(items), items)) this.enqueue(text, { now, thread: 'reports' });
    this.sql.exec('UPDATE list_items SET listed = 1 WHERE lead_id <= ? AND listed = 0', items[items.length - 1]!.number);
  }

  /** /royxat in the group: all of today's orders with who has them and the outcome — every time. */
  async listNow(now: number, thread?: number): Promise<void> {
    const where: Thread = thread ?? 'reports';
    const items = this.listItems('li.at >= ?', tashkentDayStart(now));
    if (items.length === 0) this.enqueue('📋 Бугун ҳали буюртма йўқ.', { now, thread: where });
    else for (const text of formatList(todayTitle(now, items), items)) this.enqueue(text, { now, thread: where });
    await this.flush();
  }

  /** /holat in the group: proof of life plus the numbers operators care about. */
  async reportStatus(now: number, thread?: number): Promise<void> {
    // Midnight in Tashkent (UTC+5, no daylight saving).
    const dayStart = tashkentDayStart(now);
    const today = this.sql.exec<{ n: number }>('SELECT count(*) AS n FROM leads WHERE at >= ?', dayStart).one().n;
    const last = this.sql.exec<{ at: number | null }>('SELECT max(at) AS at FROM leads').one().at;
    const queued = this.sql.exec<{ n: number }>('SELECT count(*) AS n FROM outbox').one().n;
    this.enqueue(formatStatus({ listCount: this.listCount(), listSize: this.listSize(), today, lastLeadAt: last, queued }), {
      now,
      thread: thread ?? 'reports',
    });
    await this.flush();
  }

  /**
   * A button under an order: "📞 Мен оламан", then the call's outcome. One order at a time, so
   * when two operators press "take" together only the first gets it.
   */
  async button(input: { leadId: number; action: 'take' | 'release' | LeadOutcome; userId: number; userName: string; now: number }): Promise<ButtonResult> {
    const row = this.sql
      .exec<{ taker_id: number | null; taker_name: string | null; taken_at: number | null; outcome: string | null }>(
        'SELECT taker_id, taker_name, taken_at, outcome FROM lead_status WHERE lead_id = ?',
        input.leadId,
      )
      .toArray()[0];
    if (!row) return { changed: false, toast: 'Бу буюртма жуда эски — тугмалари ишламайди.' };
    const mine = row.taker_id === input.userId;
    const name = input.userName.slice(0, 40) || 'Оператор';

    if (input.action === 'release') {
      if (row.taker_id === null) return { changed: false, toast: 'Буни ҳали ҳеч ким олмаган.' };
      this.sql.exec('UPDATE lead_status SET taker_id = NULL, taker_name = NULL, taken_at = NULL, outcome = NULL, outcome_at = NULL WHERE lead_id = ?', input.leadId);
      return { changed: true, toast: 'Буюртма қайтарилди — энди бошқа оператор олиши мумкин.', line: null, keyboard: 'take' };
    }
    if (row.taker_id !== null && !mine) return { changed: false, toast: `Бу буюртмани ${row.taker_name} олган.` };

    if (input.action === 'take') {
      if (mine) return { changed: false, toast: 'Сиз буни аллақачон олгансиз.' };
      this.sql.exec('UPDATE lead_status SET taker_id = ?, taker_name = ?, taken_at = ? WHERE lead_id = ?', input.userId, name, input.now, input.leadId);
      return {
        changed: true,
        toast: 'Сиз олдингиз. Мижозга қўнғироқ қилинг.',
        line: operatorLine({ takerName: name, takenAt: input.now, outcome: null, outcomeAt: null }),
        keyboard: 'outcome',
      };
    }

    // An outcome. Pressed without "take" first: the presser takes it at the same time.
    const takenAt = row.taken_at ?? input.now;
    this.sql.exec(
      'UPDATE lead_status SET taker_id = ?, taker_name = ?, taken_at = ?, outcome = ?, outcome_at = ? WHERE lead_id = ?',
      input.userId,
      row.taker_name ?? name,
      takenAt,
      input.action,
      input.now,
      input.leadId,
    );
    return {
      changed: true,
      toast: 'Белгиланди.',
      line: operatorLine({ takerName: row.taker_name ?? name, takenAt, outcome: input.action, outcomeAt: input.now }),
      keyboard: 'outcome',
    };
  }

  /** The day's numbers for the group: every evening by cron, and on /hisobot. */
  async dailyReport(now: number, thread?: number): Promise<void> {
    const dayStart = tashkentDayStart(now);
    const rows = this.sql
      .exec<{ taker_name: string | null; outcome: string | null }>('SELECT taker_name, outcome FROM lead_status WHERE created_at >= ?', dayStart)
      .toArray();
    const count = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length;
    const operators = new Map<string, { taken: number; sold: number }>();
    for (const r of rows) {
      if (!r.taker_name) continue;
      const o = operators.get(r.taker_name) ?? { taken: 0, sold: 0 };
      o.taken++;
      if (r.outcome === 'sold') o.sold++;
      operators.set(r.taker_name, o);
    }
    const repeats = this.sql.exec<{ n: number }>('SELECT count(*) AS n FROM leads WHERE at >= ? AND repeats > 1', dayStart).one().n;
    this.enqueue(
      formatReport({
        date: now,
        total: rows.length,
        sold: count((r) => r.outcome === 'sold'),
        noanswer: count((r) => r.outcome === 'noanswer'),
        rejected: count((r) => r.outcome === 'rejected'),
        inProgress: count((r) => r.taker_name !== null && r.outcome === null),
        untaken: count((r) => r.taker_name === null),
        repeats,
        operators: [...operators].map(([n, o]) => ({ name: n, ...o })).sort((a, b) => b.taken - a.taken),
      }),
      { now, thread: thread ?? 'reports' },
    );
    await this.flush();
  }

  /** Any other text for the group (the command help). */
  async notify(text: string, now: number, thread?: number): Promise<void> {
    this.enqueue(text, { now, thread });
    await this.flush();
  }

  /**
   * Points the bot's webhook at this site once, so commands typed in the group (/royxat,
   * /holat) reach the Worker, and registers them in Telegram's "/" menu. Done automatically
   * on the first order or health check after deploying — nothing to configure by hand.
   * Re-done once a day, so a new bot token or a removed webhook heals by itself.
   */
  async ensureWebhook(origin: string): Promise<void> {
    if (this.env.TELEGRAM_DRY_RUN === '1' || !this.env.TELEGRAM_BOT_TOKEN || !origin.startsWith('https://')) return;
    this.webhookJob ??= this.setUpWebhook(origin).finally(() => {
      this.webhookJob = null;
    });
    return this.webhookJob;
  }

  private async setUpWebhook(origin: string): Promise<void> {
    const url = `${origin}/api/telegram/hook`;
    const done = this.sql.exec<{ v: string }>("SELECT v FROM meta WHERE k = 'webhook_url'").toArray()[0]?.v;
    // The version part forces one re-registration when the bot gains new update types or commands.
    const key = `${url}|${WEBHOOK_VERSION}`;
    if (done && done.startsWith(`${key}|`) && Date.now() - Number(done.split('|')[2]) < DAY) return;
    const cfg = this.telegramConfig();
    try {
      await callTelegram(cfg, 'setWebhook', {
        url,
        secret_token: await webhookSecret(cfg.token),
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
      });
      // Customers (private chats) see only /start; the operators' group sees its own commands.
      await callTelegram(cfg, 'setMyCommands', { commands: [{ command: 'start', description: 'Буюртма бериш' }] });
      await callTelegram(cfg, 'setMyCommands', {
        scope: { type: 'chat', chat_id: cfg.chatId },
        commands: [
          { command: 'royxat', description: 'Бугунги барча буюртмалар: ким олди, натижаси' },
          { command: 'holat', description: 'Бот ишлаяптими, рўйхатда нечта буюртма бор' },
          { command: 'hisobot', description: 'Бугунги ҳисобот: нечта сотилди, ким нечта олди' },
        ],
      });
      // What a customer reads before pressing Start.
      await callTelegram(cfg, 'setMyDescription', {
        description:
          'Зейнара — юрак ва қон томирлар учун табиий сироп.\n\n«Start» тугмасини босинг, рақамингизни юборинг — оператор қўнғироқ қилиб, барча саволларга жавоб беради. Тўлов маҳсулотни олганда.',
      });
      await callTelegram(cfg, 'setMyShortDescription', { short_description: 'Зейнара буюртма бериш: «Start» тугмасини босинг.' });
      this.sql.exec("INSERT OR REPLACE INTO meta (k, v) VALUES ('webhook_url', ?)", `${key}|${Date.now()}`);
      await this.ensureTopics();
    } catch (err) {
      console.error('Telegram webhook setup failed (commands will not work yet)', (err as Error).message);
    }
  }

  private telegramConfig(): TelegramConfig {
    return { token: this.env.TELEGRAM_BOT_TOKEN, chatId: this.env.TELEGRAM_CHAT_ID, apiBase: this.env.TELEGRAM_API_BASE || undefined };
  }

  private enqueue(text: string, opts: { now: number; leadId?: number; replyToLead?: number; thread?: Thread }) {
    this.sql.exec(
      'INSERT INTO outbox (text, lead_id, reply_to_lead, created, next_try, thread_id) VALUES (?, ?, ?, ?, ?, ?)',
      text,
      opts.leadId ?? null,
      opts.replyToLead ?? null,
      opts.now,
      opts.now,
      this.threadId(opts.thread),
    );
  }

  /** The topic id for a kind of message, when the group is split into topics (else none). */
  private threadId(thread: Thread): number | null {
    if (typeof thread === 'number') return thread;
    if (!thread) return null;
    const v = this.sql.exec<{ v: string }>('SELECT v FROM meta WHERE k = ?', `topic_${thread}`).toArray()[0]?.v;
    return v ? Number(v) : null;
  }

  /**
   * When the group has Topics turned on, keeps all orders in "🆕 Буюртмалар" and lists, reports
   * and warnings in "📊 Ҳисобот", so they never mix with the operators' own chat. The bot
   * creates both topics itself (it needs the "Manage topics" admin right). Without topics
   * everything goes to the group as before.
   */
  async ensureTopics(): Promise<void> {
    if (this.env.TELEGRAM_DRY_RUN === '1' || !this.env.TELEGRAM_BOT_TOKEN) return;
    const have = (k: string) => this.sql.exec('SELECT 1 FROM meta WHERE k = ?', k).toArray().length > 0;
    if (have('topic_leads') && have('topic_reports')) return;
    const checked = Number(this.sql.exec<{ v: string }>("SELECT v FROM meta WHERE k = 'topics_checked'").toArray()[0]?.v ?? 0);
    if (Date.now() - checked < 60_000) return; // at most once a minute while topics are off
    this.sql.exec("INSERT OR REPLACE INTO meta (k, v) VALUES ('topics_checked', ?)", String(Date.now()));
    const cfg = this.telegramConfig();
    try {
      const chat = await callTelegram<{ is_forum?: boolean }>(cfg, 'getChat', { chat_id: cfg.chatId });
      if (!chat?.is_forum) return;
      for (const [key, name, color] of [
        ['topic_leads', '🆕 Буюртмалар', 0x6fb9f0],
        ['topic_reports', '📊 Ҳисобот', 0xffd67e],
      ] as const) {
        if (have(key)) continue;
        const topic = await callTelegram<{ message_thread_id: number }>(cfg, 'createForumTopic', { chat_id: cfg.chatId, name, icon_color: color });
        this.sql.exec('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', key, String(topic.message_thread_id));
      }
    } catch (err) {
      console.error('Could not set up group topics (give the bot the "Manage topics" admin right)', (err as Error).message);
    }
  }

  /**
   * One message from a customer in a private chat with the bot. The conversation is one
   * question at a time; the finished order goes through accept() like a website order, so
   * repeats, limits and numbering are the same. "Ip" is the Telegram account, so the daily
   * cap of different numbers applies per account.
   */
  async botMessage(input: BotInput): Promise<BotReply> {
    const { userId, now } = input;
    this.sql.exec('DELETE FROM bot_sessions WHERE updated_at < ?', now - DAY);
    const session = this.sql
      .exec<{ step: string; phone: string | null; verified: number; test: number }>(
        'SELECT step, phone, verified, test FROM bot_sessions WHERE user_id = ?',
        userId,
      )
      .toArray()[0];
    let test = session?.test === 1;
    const save = (step: string, phone: string | null, verified: boolean) =>
      this.sql.exec(
        'INSERT OR REPLACE INTO bot_sessions (user_id, step, phone, verified, updated_at, test) VALUES (?, ?, ?, ?, ?, ?)',
        userId,
        step,
        phone,
        verified ? 1 : 0,
        now,
        test ? 1 : 0,
      );
    const text = input.text?.trim() ?? '';

    if (/^\/start\b/i.test(text) || !session) {
      // t.me/<bot>?start=test arrives as "/start test": a dry run that creates no order.
      test = /^\/start\s+test\b/i.test(text);
      save('phone', null, false);
      return welcome(normalizeName(input.firstName).ok ? input.firstName : '', test);
    }

    if (session.step === 'phone') {
      let raw: string | null = null;
      let verified = false;
      if (input.contact) {
        // Only the customer's own number: "share my number" is filled in by Telegram itself.
        if (input.contact.ownerId !== userId) return askPhone(BOT_TEXT.notOwnContact);
        raw = input.contact.phone.startsWith('+') ? input.contact.phone : `+${input.contact.phone}`;
        verified = true;
      } else if (/\d/.test(text)) {
        raw = text;
      }
      if (!raw) return askPhone(BOT_TEXT.askPhoneAgain);
      const phone = normalizeUzPhone(raw);
      if (!phone.ok) return askPhone(BOT_TEXT.badPhone(PHONE_MESSAGES[phone.reason]));
      save('name', phone.e164, verified);
      const suggested = normalizeName(input.firstName);
      return askName(suggested.ok ? suggested.value : null);
    }

    // step === 'name'
    const name = normalizeName(text);
    if (!name.ok) return { ...askName(null), text: BOT_TEXT.badName(NAME_MESSAGES[name.reason]) };
    this.sql.exec('DELETE FROM bot_sessions WHERE user_id = ?', userId);
    if (test) {
      // No order, no number, not in lists or reports: a clearly marked note in the reports topic.
      const key = `test:${userId}`;
      const today = this.sql.exec<{ n: number }>('SELECT count(*) AS n FROM hits WHERE key = ? AND at > ?', key, now - DAY).one().n;
      if (today >= 10) return done(BOT_TEXT.testLimited);
      this.sql.exec('INSERT INTO hits (key, at) VALUES (?, ?)', key, now);
      this.enqueue(testNotice(name.value, formatUzPhone(session.phone!), session.verified === 1), { now, thread: 'reports' });
      await this.flush();
      return done(BOT_TEXT.testDone);
    }
    const result = await this.accept({
      submissionId: crypto.randomUUID(),
      ip: `tg:${userId}`,
      phone: session.phone!,
      fullName: name.value,
      utm: { source: 'telegram' },
      flags: [],
      now,
      via: session.verified ? 'bot-contact' : 'bot-typed',
    });
    if (result.status === 'ip_limited') return done(BOT_TEXT.limited);
    if (result.status === 'duplicate') return done(BOT_TEXT.duplicate);
    return done(BOT_TEXT.accepted(result.number!));
  }

  private async flush(): Promise<void> {
    const now = Date.now();
    const due = this.sql
      .exec<{ id: number; text: string; lead_id: number | null; reply_to_lead: number | null; created: number; attempts: number; thread_id: number | null }>(
        'SELECT id, text, lead_id, reply_to_lead, created, attempts, thread_id FROM outbox WHERE next_try <= ? ORDER BY id LIMIT 20',
        now,
      )
      .toArray();
    // Claim them first, so a second flush running meanwhile does not send them twice.
    for (const m of due) this.sql.exec('UPDATE outbox SET next_try = ? WHERE id = ?', now + 60_000, m.id);

    for (const m of due) {
      try {
        const replyTo = m.reply_to_lead
          ? (this.sql.exec<{ message_id: number | null }>('SELECT message_id FROM leads WHERE id = ?', m.reply_to_lead).toArray()[0]?.message_id ?? undefined)
          : undefined;
        // Orders carry the "📞 Мен оламан" button; everything else is plain text.
        const messageId = await this.deliver(m.text, replyTo, m.lead_id ? takeKeyboard(m.lead_id) : undefined, m.thread_id ?? undefined);
        if (m.lead_id) this.sql.exec('UPDATE leads SET message_id = ? WHERE id = ?', messageId, m.lead_id);
        this.sql.exec('DELETE FROM outbox WHERE id = ?', m.id);
      } catch (err) {
        // The topic was deleted or topics were turned off: forget it and send to the group instead.
        if (m.thread_id && /thread|topic/i.test((err as Error).message)) {
          this.sql.exec("DELETE FROM meta WHERE k IN ('topic_leads', 'topic_reports')");
          this.sql.exec('UPDATE outbox SET thread_id = NULL, next_try = ? WHERE thread_id IS NOT NULL', now);
          continue;
        }
        const attempts = m.attempts + 1;
        const permanent = err instanceof TelegramError && err.permanent;
        console.error(`Telegram delivery failed (attempt ${attempts})${permanent ? ': check TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID' : ''}`, (err as Error).message);
        if (now - m.created > GIVE_UP_AFTER) {
          console.error('Giving up on a message older than 7 days; the order was never delivered to Telegram');
          this.sql.exec('DELETE FROM outbox WHERE id = ?', m.id);
          continue;
        }
        // 30 s, 2 min, 8 min, 32 min, then hourly.
        const backoff = Math.min(HOUR, 30_000 * 4 ** Math.min(attempts - 1, 4));
        this.sql.exec('UPDATE outbox SET attempts = ?, next_try = ? WHERE id = ?', attempts, now + backoff, m.id);
      }
    }

    const next = this.sql.exec<{ t: number | null }>('SELECT min(next_try) AS t FROM outbox').one().t;
    if (next !== null) await this.ctx.storage.setAlarm(Math.max(next, Date.now() + 1000));
  }

  private async deliver(text: string, replyTo?: number, keyboard?: InlineKeyboard, threadId?: number): Promise<number> {
    if (this.env.TELEGRAM_DRY_RUN === '1') {
      console.log(`[TELEGRAM_DRY_RUN] message to the operators' group:\n${text}`);
      return Math.floor(Math.random() * 1e9);
    }
    return sendTelegram(this.telegramConfig(), text, replyTo, keyboard, threadId);
  }

  private prune(now: number) {
    this.sql.exec('DELETE FROM hits WHERE at < ?', now - DAY);
    this.sql.exec('DELETE FROM submissions WHERE at < ?', now - 7 * DAY);
    this.sql.exec('DELETE FROM leads WHERE at < ?', now - 30 * DAY);
    this.sql.exec('DELETE FROM list_items WHERE at < ?', now - 7 * DAY);
    this.sql.exec('DELETE FROM lead_status WHERE created_at < ?', now - 30 * DAY);
    this.sql.exec('DELETE FROM bot_sessions WHERE updated_at < ?', now - DAY);
  }

  /** Keyed hash (HMAC-SHA-256) with a random secret created on first use and kept here. */
  private async hash(value: string): Promise<string> {
    if (!this.secret) {
      let raw = this.sql.exec<{ v: string }>("SELECT v FROM meta WHERE k = 'hash_secret'").toArray()[0]?.v;
      if (!raw) {
        raw = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
        this.sql.exec("INSERT INTO meta (k, v) VALUES ('hash_secret', ?)", raw);
      }
      this.secret = await crypto.subtle.importKey('raw', new TextEncoder().encode(raw), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    }
    const sig = await crypto.subtle.sign('HMAC', this.secret, new TextEncoder().encode(value));
    return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}

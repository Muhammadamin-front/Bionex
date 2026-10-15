import { DurableObject } from 'cloudflare:workers';
import {
  callTelegram,
  formatLead,
  formatList,
  formatListStatus,
  formatRepeat,
  formatStatus,
  sendTelegram,
  TelegramError,
  webhookSecret,
  type TelegramConfig,
} from './telegram';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Order attempts per phone number per hour, on top of Turnstile and the per-IP limit. */
const PHONE_REQUESTS_PER_HOUR = 5;
/** Orders that Telegram never accepted are given up (and logged) after this long. */
const GIVE_UP_AFTER = 7 * DAY;

export type CheckResult = { kind: 'go' } | { kind: 'replay'; status: 'accepted' | 'duplicate' } | { kind: 'limited' };
export type AcceptResult = { status: 'accepted' | 'duplicate' | 'ip_limited' };

export interface OrderInput {
  submissionId: string;
  ip: string;
  /** E.164. */
  phone: string;
  fullName: string;
  utm: Record<string, string | undefined>;
  flags: string[];
  now: number;
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
 * that is still waiting for Telegram, and until their 10-order list is sent (at most 30 days).
 */
export class LeadRegistry extends DurableObject<Env> {
  private readonly sql: SqlStorage;
  private secret: CryptoKey | null = null;

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
    `);
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
      if (repeats <= 5) this.enqueue(formatRepeat(input.phone, repeats, now), { replyToLead: earlier.id, now });
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
    });
    // The order first, then (if it completed one) the list under it.
    this.enqueue(text, { leadId, now });
    if (list?.full) this.sendList(now);
    this.sql.exec('INSERT INTO submissions (id, status, at) VALUES (?, ?, ?)', input.submissionId, 'accepted', now);
    this.prune(now);
    await this.flush();
    return { status: 'accepted' };
  }

  /** A configuration problem that silently loses every order: tell the group, at most hourly. */
  async alert(kind: string, text: string, now: number): Promise<void> {
    const last = this.sql.exec<{ at: number }>('SELECT at FROM alerts WHERE kind = ?', kind).toArray()[0];
    if (last && now - last.at < HOUR) return;
    this.sql.exec('INSERT OR REPLACE INTO alerts (kind, at) VALUES (?, ?)', kind, now);
    this.enqueue(text, { now });
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
    const size = this.listSize();
    if (size === 0) return null;
    this.sql.exec(
      'INSERT INTO list_items (lead_id, name, phone, at, flagged) VALUES (?, ?, ?, ?, ?)',
      leadId,
      input.fullName,
      input.phone,
      now,
      input.flags.length > 0 ? 1 : 0,
    );
    const count = this.listCount();
    return { count, size, full: count >= size };
  }

  private listSize(): number {
    const size = Number(this.env.LEADS_PER_LIST ?? 10);
    return size > 0 ? size : 0;
  }

  private listCount(): number {
    return this.sql.exec<{ n: number }>('SELECT count(*) AS n FROM list_items').one().n;
  }

  /** Queues the collected orders (up to one list's worth) as one numbered list; returns how many. */
  private sendList(now: number): number {
    const items = this.sql
      .exec<{ lead_id: number; name: string; phone: string; at: number; flagged: number }>(
        'SELECT lead_id, name, phone, at, flagged FROM list_items ORDER BY lead_id LIMIT ?',
        Math.max(this.listSize(), 1),
      )
      .toArray();
    if (items.length === 0) return 0;
    this.enqueue(
      formatList(items.map((i) => ({ number: i.lead_id, fullName: i.name, phone: i.phone, createdAt: i.at, flagged: i.flagged === 1 }))),
      { now },
    );
    this.sql.exec('DELETE FROM list_items WHERE lead_id <= ?', items[items.length - 1]!.lead_id);
    return items.length;
  }

  /** /royxat in the group: send what has been collected now, even if fewer than the list size. */
  async listNow(now: number): Promise<void> {
    if (this.sendList(now) === 0) this.enqueue(formatListStatus(0, this.listSize() || 1), { now });
    await this.flush();
  }

  /** /holat in the group: proof of life plus the numbers operators care about. */
  async reportStatus(now: number): Promise<void> {
    // Midnight in Tashkent (UTC+5, no daylight saving).
    const tz = 5 * HOUR;
    const dayStart = Math.floor((now + tz) / DAY) * DAY - tz;
    const today = this.sql.exec<{ n: number }>('SELECT count(*) AS n FROM leads WHERE at >= ?', dayStart).one().n;
    const last = this.sql.exec<{ at: number | null }>('SELECT max(at) AS at FROM leads').one().at;
    const queued = this.sql.exec<{ n: number }>('SELECT count(*) AS n FROM outbox').one().n;
    this.enqueue(formatStatus({ listCount: this.listCount(), listSize: this.listSize(), today, lastLeadAt: last, queued }), { now });
    await this.flush();
  }

  /** Any other text for the group (the command help). */
  async notify(text: string, now: number): Promise<void> {
    this.enqueue(text, { now });
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
    const url = `${origin}/api/telegram/hook`;
    const done = this.sql.exec<{ v: string }>("SELECT v FROM meta WHERE k = 'webhook_url'").toArray()[0]?.v;
    if (done && done.startsWith(`${url}|`) && Date.now() - Number(done.split('|')[1]) < DAY) return;
    const cfg = this.telegramConfig();
    try {
      await callTelegram(cfg, 'setWebhook', {
        url,
        secret_token: await webhookSecret(cfg.token),
        allowed_updates: ['message'],
        drop_pending_updates: true,
      });
      await callTelegram(cfg, 'setMyCommands', {
        commands: [
          { command: 'royxat', description: 'Йиғилган буюртмалар рўйхатини ҳозир юбориш' },
          { command: 'holat', description: 'Бот ишлаяптими, рўйхатда нечта буюртма бор' },
        ],
      });
      this.sql.exec("INSERT OR REPLACE INTO meta (k, v) VALUES ('webhook_url', ?)", `${url}|${Date.now()}`);
    } catch (err) {
      console.error('Telegram webhook setup failed (commands will not work yet)', (err as Error).message);
    }
  }

  private telegramConfig(): TelegramConfig {
    return { token: this.env.TELEGRAM_BOT_TOKEN, chatId: this.env.TELEGRAM_CHAT_ID, apiBase: this.env.TELEGRAM_API_BASE || undefined };
  }

  private enqueue(text: string, opts: { now: number; leadId?: number; replyToLead?: number }) {
    this.sql.exec(
      'INSERT INTO outbox (text, lead_id, reply_to_lead, created, next_try) VALUES (?, ?, ?, ?, ?)',
      text,
      opts.leadId ?? null,
      opts.replyToLead ?? null,
      opts.now,
      opts.now,
    );
  }

  private async flush(): Promise<void> {
    const now = Date.now();
    const due = this.sql
      .exec<{ id: number; text: string; lead_id: number | null; reply_to_lead: number | null; created: number; attempts: number }>(
        'SELECT id, text, lead_id, reply_to_lead, created, attempts FROM outbox WHERE next_try <= ? ORDER BY id LIMIT 20',
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
        const messageId = await this.deliver(m.text, replyTo);
        if (m.lead_id) this.sql.exec('UPDATE leads SET message_id = ? WHERE id = ?', messageId, m.lead_id);
        this.sql.exec('DELETE FROM outbox WHERE id = ?', m.id);
      } catch (err) {
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

  private async deliver(text: string, replyTo?: number): Promise<number> {
    if (this.env.TELEGRAM_DRY_RUN === '1') {
      console.log(`[TELEGRAM_DRY_RUN] message to the operators' group:\n${text}`);
      return Math.floor(Math.random() * 1e9);
    }
    return sendTelegram(this.telegramConfig(), text, replyTo);
  }

  private prune(now: number) {
    this.sql.exec('DELETE FROM hits WHERE at < ?', now - DAY);
    this.sql.exec('DELETE FROM submissions WHERE at < ?', now - 7 * DAY);
    this.sql.exec('DELETE FROM leads WHERE at < ?', now - 30 * DAY);
    this.sql.exec('DELETE FROM list_items WHERE at < ?', now - 30 * DAY);
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

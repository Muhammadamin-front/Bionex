# Zeynara — lead landing page

A mobile-first, Uzbek (Cyrillic) product page with an order form (name + phone). Orders go
straight to the operators' **Telegram group**. Everything runs on **Cloudflare's free plan**:
no server to rent, no database to manage.

- **Website:** React + Vite + TypeScript + Tailwind CSS 4 (`apps/web`) — built for older
  visitors and old phones (iOS 12+, Android Chrome 70+).
- **Order API:** one Cloudflare Worker (`apps/worker`) that also serves the website.
- **Validation:** the same Zod rules in the browser and the Worker (`packages/shared`).

```
Visitor ─► Cloudflare Worker ──► website files (apps/web/dist)
              │  POST /api/leads
              ├─► Cloudflare Turnstile (is it a real person?)
              ├─► LeadRegistry (Durable Object: repeats, per-IP limit, retry queue)
              └─► Telegram group of the operators
```

## How an order is handled

1. The form validates the name and the Uzbek phone number (also "8 90…" and "+998…" input).
2. The Worker refuses posts from other websites, malformed or oversized bodies, and more than
   3 attempts per IP per hour (`IP_ORDERS_PER_HOUR`, failed ones count) or 5 per phone number per hour.
3. **Turnstile** is checked with Cloudflare: the token must be fresh, for this form, for this
   exact order attempt and for this site's address.
4. The **LeadRegistry** decides, one order at a time (so two simultaneous clicks never make
   two orders):
   - same number within 24 h → "already received", and a 🔁 reply under the first message so
     the operator calls sooner;
   - one IP may order for at most 3 different numbers a day (`LEADS_PER_IP_PER_DAY`) — the
     4th is told to call instead (competitors typing strangers' numbers);
   - otherwise a new order: numbered (№37), recorded, then sent to Telegram with a status
     line ("📋 3 collected, 7 more and the list is sent");
   - every `LEADS_PER_LIST` (10) new orders the group also gets them as one numbered list,
     so operators can share out the calls. Repeats are not numbered or listed.
5. The customer sees "accepted" only after the order is recorded. If Telegram is down, the
   message waits in the registry and is retried automatically (30 s … hourly, up to 7 days).
6. A filled hidden field (bot) or a made-up looking number is still delivered, marked ⚠️.
7. If Turnstile is misconfigured (wrong secret, test key, wrong address) every order would be
   refused — so the group gets a ⚠️ warning (at most once an hour).

Privacy: IPs and phone numbers are kept only as keyed hashes for 30 days (for repeats and
limits); a name and number are stored in clear only while a message waits for Telegram.

## Commands

```bash
npm install
npm run dev              # site on http://localhost:5173, Worker on :8787 (orders printed, not sent)
npm test                 # shared rules + Worker tests in the real Cloudflare runtime (workerd)
npm run typecheck
npm run deploy           # builds the site (refuses test keys) and publishes to Cloudflare
npm run telegram:setup   # connects the Telegram group step by step
```

Local secrets live in `apps/worker/.dev.vars` (copy of `.dev.vars.example`; Turnstile test
key, `TELEGRAM_DRY_RUN=1`). Production values: see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Settings

| Where | Name | What |
|---|---|---|
| `apps/web/.env.production` | `VITE_TURNSTILE_SITE_KEY` | Turnstile **site** key (public) |
| | `VITE_SITE_URL` | `https://zeynara.<account>.workers.dev` or your domain (link previews) |
| | `VITE_META_PIXEL_ID` | Meta Pixel id (optional) |
| Cloudflare secret | `TURNSTILE_SECRET_KEY` | Turnstile **secret** key |
| | `TELEGRAM_BOT_TOKEN` | from @BotFather |
| | `TELEGRAM_CHAT_ID` | the private group or channel id (`npm run telegram:setup` finds it) |
| `apps/worker/wrangler.jsonc` | `IP_ORDERS_PER_HOUR` | order attempts per IP per hour, default 3 |
| | `LEADS_PER_IP_PER_DAY` | different numbers per IP per day, default 3 |
| | `DUPLICATE_WINDOW_HOURS` | default 24 |
| | `LEADS_PER_LIST` | orders per list, default 10; 0 = no lists |

`GET /api/health` shows whether the secrets are set and how many messages wait for Telegram.

**Commands in the group** (the site connects the bot's webhook by itself after the first
order or health check, and re-checks it daily): `/royxat` sends the orders collected so far
as a list now, even fewer than 10; `/holat` answers that the bot is alive, with today's count,
the last order time and anything still waiting for Telegram.

## Before you launch — content checklist

The page content lives in `apps/web/src/config/product.ts`; images in
`apps/web/public/images/zeynara/`. Every value marked **VERIFY** must be a fact you can prove:
health statements (must match the supplement's approved label), delivery and payment promises,
the "15 minutes" call-back promise, legal name.

- `reviews` are the five real customer reviews from the old site; keep each customer's written
  consent on file. `expert` stays empty unless a real specialist gives written consent.
- No medical/treatment/"clinically proven"/certification claims unless legally approved for this
  exact product.

## Further documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — publishing on Cloudflare, step by step
- [docs/TURNSTILE.md](docs/TURNSTILE.md) — Turnstile keys
- [docs/SECURITY.md](docs/SECURITY.md) — what protects the form, and why
- [docs/ANIMATIONS.md](docs/ANIMATIONS.md) — which animations were used, and why

The previous, heavier version (Express + PostgreSQL + admin panel + Google Sheets + AI
assistant) is archived in `Desktop/Bionex-toliq-versiya-2026-10-14.tar.gz`.
# Bionex
# Bionex

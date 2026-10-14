# Security checklist

✅ = enforced by code (and tested in `apps/worker/test/worker.test.ts` or
`packages/shared/src/shared.test.ts`). ☐ = a step for you.

## Secrets
- ✅ Secrets (`TURNSTILE_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) live only in
  Cloudflare (`wrangler secret put`); the browser gets only public `VITE_*` values.
- ✅ `.env*`, `.dev.vars` and `.wrangler/` are git-ignored.
- ✅ `npm run deploy` refuses a Turnstile test/empty site key or a non-https site URL.
- ✅ `/api/health` reports whether settings exist, never their values.
- ☐ Keep the bot token private; if it leaks, @BotFather → /revoke, then `npm run telegram:setup`.
- ☐ Make the Telegram group private and add only the operators.

## Order form abuse
- ✅ Turnstile checked with Cloudflare: missing, invalid, expired, reused, wrong-action,
  wrong-site and wrong-attempt (cData) tokens are refused.
- ✅ Strict Zod validation (unknown keys refused, 8 KB limit, phone normalised to +998…,
  name character rules), the same rules as in the browser.
- ✅ Per IP: 10 attempts per 10 minutes; per phone number: 5 per hour (HTTP 429).
- ✅ One IP may order for at most `LEADS_PER_IP_PER_DAY` (3) different numbers a day; the
  rest are told to call. Customers re-sending their own number are never blocked.
- ✅ Repeats of a number within 24 h become one order plus a 🔁 note — decided inside one
  Durable Object, so simultaneous clicks can never create two orders.
- ✅ Honeypot and made-up looking numbers are **flags** (⚠️ in the message), not blocks.
- ✅ Every message shows a short source id (`#a1b2c3`) and how many numbers that source sent
  today, so operators can spot someone typing strangers' numbers.
- ✅ Posts from other websites (foreign `Origin`) are refused.
- ✅ HTML in visitor input is escaped in Telegram messages.
- ✅ No fingerprinting; cookies, localStorage and User-Agent are not used for identity.
- ☐ Optional: a Cloudflare WAF rate-limit rule for `POST /api/leads`.

## Never losing an order
- ✅ "Accepted" only after the order is written to durable storage (the Durable Object).
- ✅ If Telegram is unreachable, messages wait and are retried (30 s … hourly, up to 7 days);
  `/api/health` shows how many are waiting.
- ✅ Turnstile misconfiguration (wrong secret, test key, wrong address) warns the group.
- ✅ Any unexpected error answers "try again or call +998 55 508 56 56" — never a false success.

## Privacy
- ✅ IPs and phone numbers are stored only as HMAC hashes (secret generated inside the
  Durable Object), for 30 days.
- ✅ Name and number are stored in clear only while a message waits for Telegram.
- ✅ Nothing personal is written to logs.
- ☐ Delete group messages older than the period stated in the privacy notice (`retentionText`).
- ☐ Telegram and Cloudflare store data outside Uzbekistan; ask a lawyer about the
  personal-data law's localisation rules for your case.

## Headers
- ✅ CSP (only self, Turnstile and Meta), HSTS, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy` — from `dist/_headers`; API responses are `no-store`.

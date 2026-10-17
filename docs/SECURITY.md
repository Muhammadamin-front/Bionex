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
- ✅ Per IP: 3 order attempts per hour, failed ones included (`IP_ORDERS_PER_HOUR`); per phone
  number: 5 per hour (HTTP 429, with the phone number to call).
- ☐ Mobile operators put many customers behind one IP: if real customers say the site told them
  "too many attempts", raise `IP_ORDERS_PER_HOUR` in `apps/worker/wrangler.jsonc` and `npm run deploy`.
- ✅ One IP may order for at most `LEADS_PER_IP_PER_DAY` (3) different numbers a day; the
  rest are told to call. Re-sending one's own number does not count toward this daily cap.
- ✅ Repeats of a number within 24 h become one order plus a 🔁 note — decided inside one
  Durable Object, so simultaneous clicks can never create two orders.
- ✅ Honeypot and made-up looking numbers are **flags** (⚠️ in the message), not blocks.
- ✅ Every message shows a short source id (`#a1b2c3`) and how many numbers that source sent
  today, so operators can spot someone typing strangers' numbers.
- ✅ Posts from other websites (foreign `Origin`) are refused.
- ✅ Group commands and order buttons (`/api/telegram/hook`) are accepted only with the secret
  header Telegram was given (derived from the bot token) and only from `TELEGRAM_CHAT_ID`;
  anything else is ignored. Taking an order is decided inside the Durable Object, so two
  operators pressing at once cannot both get it. Only operator first names and outcomes are
  stored for the report (30 days); the order message itself is reused, no customer data is kept.
- ✅ HTML in visitor input is escaped in Telegram messages.
- ✅ Bot orders: a shared contact is accepted only if it is the sender's own number
  (`contact.user_id`), typed numbers are marked as unconfirmed, names and numbers go through
  the same validation as the website, and one Telegram account may order for at most
  `LEADS_PER_IP_PER_DAY` different numbers a day. The conversation state (number before the
  name arrives) is kept at most 24 h.
- ✅ No fingerprinting *for abuse decisions*: whether an order is accepted, refused or counted
  as a repeat depends only on hashed IP and phone. Cookies, localStorage and User-Agent play
  no part in it. (Meta's `_fbp`/`_fbc` cookies and the User-Agent are forwarded to the
  Conversions API — see Privacy below.)
- ☐ Optional: a Cloudflare WAF rate-limit rule for `POST /api/leads`.

## Never losing an order
- ✅ "Accepted" only after the order is written to durable storage (the Durable Object).
- ✅ If Telegram is unreachable, messages wait and are retried (30 s … hourly, up to 7 days);
  `/api/health` shows how many are waiting.
- ✅ Turnstile misconfiguration (wrong secret, test key, wrong address) warns the group.
- ✅ Any unexpected error answers "try again" (plus "or call …" when `site.phone` is set) — never a false success.

## Privacy
- ✅ IPs and phone numbers are stored only as HMAC hashes (secret generated inside the
  Durable Object), for 30 days.
- ✅ Name and number are stored in clear only while a message waits for Telegram, and until
  their 10-order list is sent (deleted after 30 days at the latest).
- ✅ Nothing personal is written to logs.
- ✅ Meta Conversions API (only when **both** `META_PIXEL_ID` and `META_CAPI_TOKEN` are set):
  an accepted order sends Meta a one-way **SHA-256** of the phone number, first name, last name
  and `uz`, plus the IP address, the User-Agent and the `_fbp`/`_fbc` cookies. Nothing of this
  is stored anywhere — it is computed for that one request. The access token travels in the
  request body, never in the URL. Delete either secret and the whole feature is off
  (see [META-CAPI.md](META-CAPI.md)).
- ☐ Delete old order messages from the group when they are no longer needed.
- ☐ Telegram and Cloudflare store data outside Uzbekistan; ask a lawyer about the
  personal-data law's localisation rules for your case.

## Headers
- ✅ CSP (only self, Turnstile and Meta), HSTS, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy` — from `dist/_headers`; API responses are `no-store`.

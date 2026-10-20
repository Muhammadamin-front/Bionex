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
  wrong-site and wrong-attempt (cData) tokens never pass. Such an order is **not refused** —
  some real phones cannot finish the check — but arrives marked
  "⚠️ «бот эмасман» текшируви ўтмади" and is still subject to every limit below. The form waits
  for the check at most ~14 s, so nobody is stuck on it. The mark no longer decides what Meta
  hears: the operator's outcome button does (see [META-CAPI.md](META-CAPI.md)).
- ✅ Strict Zod validation (unknown keys refused, 8 KB limit, phone normalised to +998…,
  name character rules), the same rules as in the browser.
- ✅ Per IP: 3 order attempts per hour, failed ones included (`IP_ORDERS_PER_HOUR`); per phone
  number: 5 per hour (HTTP 429, with the phone number to call).
- ⚠️ `IP_ORDERS_PER_HOUR` is deliberately low: the fake orders here are sent **by hand** by one
  hostile ex-employee, and this is the only cap that costs him something per attempt. Mobile
  operators do put many customers behind one IP, so it will occasionally tell a real customer
  "too many attempts" — read [SPAM.md](SPAM.md) before raising it.
- ✅ One IP may order for at most `LEADS_PER_IP_PER_DAY` (3) different numbers a day; the
  rest are told to call. Re-sending one's own number does not count toward this daily cap.
- ✅ Repeats of a number within 24 h become one order plus a 🔁 note — decided inside one
  Durable Object, so simultaneous clicks can never create two orders.
- ✅ Honeypot and made-up looking numbers are **flags** (⚠️ in the message), not blocks.
- ✅ Every message shows a short source id (`#a1b2c3`) and how many numbers that source sent
  today, so operators can spot someone typing strangers' numbers.
- ✅ 🚫 Спам remembers the order's network (hashed, 30 days): later orders from it arrive marked
  "⚠️ бу манбадан аввал спам белгиланган", and no order marked spam is ever reported to Meta.
- ✅ Posts from other websites (foreign `Origin`) are refused.
- ✅ Group commands and order buttons (`/api/telegram/hook`) are accepted only with the secret
  header Telegram was given (derived from the bot token) and only from `TELEGRAM_CHAT_ID`;
  anything else is ignored. Taking an order is decided inside the Durable Object, so two
  operators pressing at once cannot both get it. Only operator first names and outcomes are
  stored for the report (30 days); the order message itself is reused, no customer data is kept.
- ✅ HTML in visitor input is escaped in Telegram messages.
- ✅ Operators' Mini App (`/panel`, `/api/panel/*`): every call must carry Telegram-signed
  initData (HMAC with the bot token, at most 24 h old) of a current member of `TELEGRAM_CHAT_ID`
  (checked with `getChatMember`, cached 5 min). The page holds no data, has its own CSP (nonce
  script, `connect-src 'self'`, framing only by telegram.org) and builds every customer value
  with `textContent`.
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
- ✅ A failed or unfinished Turnstile check never blocks an order (it arrives marked ⚠️).
- ✅ Turnstile misconfiguration (wrong secret, test key, wrong address) warns the group.
- ✅ Any unexpected error answers "try again" (plus "or call …" when `site.phone` is set) — never a false success.

## Privacy
- ✅ IPs and phone numbers are stored only as HMAC hashes (secret generated inside the
  Durable Object), for 30 days.
- ✅ Name and number are stored in clear only while a message waits for Telegram, and for
  30 days for the operators' `/royxat` list and panel, archive included (then deleted).
- ✅ The panel's browser link (`/panel?key=…`) is personal, signed with the bot token, valid
  7 days, sent only in a private chat, and still checked against group membership on every
  request. `TELEGRAM_DRY_RUN` skips panel sign-in only on `localhost`.
- ✅ Nothing personal is written to logs.
- ✅ The browser keeps one random id for this site (`localStorage`, `apps/web/src/lib/device.ts`)
  and sends it with an order; it is stored only as an HMAC hash, so that a spam mark can follow
  a phone across networks (30 days). It is not a fingerprint and says nothing about the person.
- ✅ The partner site ([PARTNER-SITE.md](PARTNER-SITE.md)): its orders go only to its owner's
  Google Sheet (name and phone number included — their people ring the customers) and their
  Meta dataset. This Worker keeps only their hashes (`partner_leads`, 30 days) for repeats and
  limits. Main-site orders never reach that sheet or dataset.
- ✅ Meta Conversions API (only when **both** `META_PIXEL_ID` and `META_CAPI_TOKEN` are set):
  once an operator has rung the customer and pressed ✅ or ❌, Meta is sent a one-way
  **SHA-256** of the phone number, first name, last name and `uz`, plus the IP address, the
  User-Agent and the `_fbp`/`_fbc` cookies. The hashes are computed during the order's own
  request and held in `meta_pending` (with the raw IP, User-Agent and those two cookies) until
  the button is pressed, and at most 7 days — the longest event age Meta accepts. The row is
  deleted as the event goes out, or pruned unsent. The access token travels in the request
  body, never in the URL. Delete either secret and the whole feature is off
  (see [META-CAPI.md](META-CAPI.md)).
- ☐ Delete old order messages from the group when they are no longer needed.
- ☐ Telegram and Cloudflare store data outside Uzbekistan; ask a lawyer about the
  personal-data law's localisation rules for your case.

## Headers
- ✅ CSP (only self, Turnstile and Meta), HSTS, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy` — from `dist/_headers`; API responses are `no-store`.

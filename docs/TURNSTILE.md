# Cloudflare Turnstile setup

Turnstile is Cloudflare's CAPTCHA alternative. Most visitors never see a puzzle; the
widget runs a quick invisible check and hands the browser a **token**. The token alone
proves nothing — our server sends it to Cloudflare's Siteverify API with a **secret key**
and only accepts the order if Cloudflare confirms it.

## 1. Local development (no account needed)

`apps/web/.env` and `apps/worker/.dev.vars` already use Cloudflare's official test keys
(`1x00000000000000000000AA` site key, `1x0000000000000000000000000000000AA` secret: always pass).
`npm run deploy` refuses to publish a site built with a test key.

## 2. Create the real widget

1. Cloudflare dashboard → **Turnstile** → **Add widget**.
2. **Hostnames:** the site's address, e.g. `zeynara.<account>.workers.dev` (a subdomain is
   fine; adding a domain also covers its subdomains; up to 10 hostnames on the free plan).
3. **Widget mode:** *Managed*.
4. Copy the **Site key** and the **Secret key**.

## 3. Configure

```bash
# apps/web/.env.production  (public — compiled into the JavaScript)
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAA...

# Secret — Cloudflare only, never in a file in the project:
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Then `npm run deploy`.

## 4. What the Worker checks

For every order (`apps/worker/src/turnstile.ts`):

- the token is present;
- Cloudflare says `success: true` — expired or **reused** tokens are rejected (single-use, 300 s);
- `action` is `lead-submit`;
- `cdata` equals this order attempt's id — the token is bound to *this* attempt;
- `hostname` is the address the request came to (no setting needed; works for a new domain too);
- the visitor's IP is sent as `remoteip`.

A wrong secret, a test site key or an address missing from the widget would fail the check
for every order: the Worker logs it and warns the Telegram group (at most hourly).

## 5. If the check cannot finish

Some phones never finish Turnstile (in-app browsers, VPNs, old devices, filtered networks).
A customer must never be stuck on "Текширилмоқда", so:

- the form waits for the check at most ~14 s, then sends the order anyway;
- the Worker **accepts** an order whose token is missing, invalid or unverifiable (Cloudflare
  unreachable), and marks it for the operators:
  `⚠️ Текширинг: «бот эмасман» текшируви ўтмади (бот ёки эски телефон бўлиши мумкин)`;
- the mark no longer decides what Meta hears. It used to keep such orders out of the
  Conversions API; now the operator's outcome button decides, and an order marked ⚠️ is
  reported like any other once an operator has spoken to the customer
  ([META-CAPI.md](META-CAPI.md)). On the phones this mark actually appears on — old devices and
  Instagram's in-app browser — the person is usually a real customer, and the operator is the
  better judge than the check;
- every other protection still applies: foreign `Origin`, IP and phone limits, the daily cap
  per IP, repeats, honeypot, made-up numbers and the operators' 🚫 Спам button.

## 6. The widget is invisible unless it challenges

`appearance: 'interaction-only'` (`OrderForm.tsx`): no checkbox, no box between the phone field
and the order button, and nothing drawn at all unless Turnstile decides this visitor needs to
do something. It still runs, still produces a token, and the Worker still checks it exactly as
above — the only change is that the honest customer never sees it. Note that this is not a
defence against the fake orders on this site: those are sent by a person who would pass any
challenge ([SPAM.md](SPAM.md)).

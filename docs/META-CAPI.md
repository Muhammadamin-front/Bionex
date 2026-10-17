# Meta Conversions API (server-side Lead events)

Every accepted order is reported to Meta **twice**: once from the visitor's browser (the
Pixel) and once from the Worker (the Conversions API). Meta merges the two into one Lead.

Why bother: the browser copy is lost whenever an ad blocker, a privacy browser or iOS
tracking protection stops `fbq` from loading — and a large share of this campaign's traffic
arrives through Instagram's in-app browser. The server copy always leaves Cloudflare, so ad
optimisation sees every order and can learn who actually buys.

```
Visitor submits the form
        │
        ├─► POST /api/leads ──► LeadRegistry ──► Telegram group       (always)
        │                           │
        │                           └─ status: accepted
        │                                   │
        │                                   └─► graph.facebook.com    ← this document
        │                                        event_id = submissionId
        │
        └─► fbq('track', 'Lead', …, { eventID: submissionId })        (browser, blockable)
```

Both copies carry the same `event_id`, so Meta counts **one** Lead, never two.

## Files

| File | What |
|---|---|
| `apps/worker/src/meta.ts` | builds and sends the event; all of the logic lives here |
| `apps/worker/src/index.ts` | calls it after an order is accepted (step 5 in `fetch`) |
| `apps/web/src/lib/pixel.ts` | the browser half (`trackLead(submissionId)`) |
| `apps/worker/test/worker.test.ts` | `describe('the Lead event sent to Meta from the server')` |

## When it fires

Only for `status === 'accepted'` — exactly like the browser Pixel.

A repeat of the same phone number inside `DUPLICATE_WINDOW_HOURS` answers `duplicate`: the
customer still sees a friendly message and the operators still get a 🔁 note, but **no Lead
is sent** from either side. That is deliberate — one customer must not become two leads.

> This surprised us once: two test orders from the same number produced only one Lead in
> Events Manager, which looked like a broken Pixel. It was not. Test with a *different*
> number each time.

The call runs inside `ctx.waitUntil()`, so it never delays the customer's answer, and a
failure is logged and dropped — the order is already safe in the registry and on its way to
Telegram. Meta is never allowed to break an order.

## What is sent to Meta

| Field | Value |
|---|---|
| `event_name` | `Lead` |
| `event_id` | the order's `submissionId` (de-duplication with the Pixel) |
| `event_time`, `event_source_url`, `action_source` | timestamp, the page, `website` |
| `user_data.ph` | **SHA-256** of the phone number, digits only (`998901234567`) |
| `user_data.fn`, `.ln` | **SHA-256** of the first and last name, lower-cased |
| `user_data.country` | **SHA-256** of `uz` |
| `user_data.client_ip_address`, `.client_user_agent` | from the request |
| `user_data.fbp`, `.fbc` | the `_fbp` / `_fbc` cookies, read from the request's `Cookie` header |
| `custom_data` | `content_name: Zeynara`, `content_category: Health Supplement` |

The hashes are one-way: Meta can confirm a match against a number it already has, it cannot
read the number. They are computed for the one request and never stored.

`_fbp` and `_fbc` are the strongest matching signals. They work without any change to the
website because the site and the API share one origin, so the browser sends those cookies
along with `POST /api/leads` automatically.

The access token travels in the **request body**, never in the URL — URLs end up in logs.

## Configuration

Two Cloudflare secrets. **Both or neither**: if either is missing the whole feature is off
and leads are reported from the browser only.

```bash
cd apps/worker
printf "1109358048693673" | npx wrangler secret put META_PIXEL_ID
npx wrangler secret put META_CAPI_TOKEN     # paste the token
npx wrangler secret list                    # expect 5 secrets
```

`META_PIXEL_ID` is the same dataset id the website's Pixel uses (`VITE_META_PIXEL_ID`).

The token comes from **Events Manager → Datasets → (dataset) → Settings → Conversions API →
Set up direct integration → "Set up without Dataset Quality API" → generate access token**.

> Do **not** use "Connect with Conversions API Gateway". That is a separate hosted cloud
> product (Datahash, AWS, …) with its own cost, and it would route customer data through a
> third party. The Worker already does the same job for free.

Optional, for local work only (`apps/worker/.dev.vars`):

| Name | What |
|---|---|
| `META_TEST_EVENT_CODE` | `TEST…` from Events Manager → **Test events**; the event shows up there instead of counting |
| `META_API_BASE` | points the Graph API elsewhere; used by the tests |

## Testing locally, without touching the live site

`apps/worker/.dev.vars` already holds a Turnstile **test** key (any token passes) and
`TELEGRAM_DRY_RUN=1` (orders are printed, not sent). Add the Meta secrets and a test event
code there, then:

```bash
cd apps/worker
npx wrangler dev --port 8787
```

In another terminal (keep the Events Manager **Test events** tab open):

```bash
SID=$(uuidgen | tr 'A-Z' 'a-z')
curl -s -X POST http://127.0.0.1:8787/api/leads \
  -H 'content-type: application/json' \
  -H 'cf-connecting-ip: 84.54.70.11' \
  -H 'user-agent: Mozilla/5.0 (iPhone) Instagram' \
  -H 'referer: https://zeynara.8pj6jsdbgr.workers.dev/' \
  -H 'cookie: _fbp=fb.1.1760600000000.987654321; _fbc=fb.1.1760600000000.IwAR0test' \
  -d "{\"fullName\":\"Тест Синов\",\"phone\":\"+998 90 999 88 77\",\"submissionId\":\"$SID\",\"turnstileToken\":\"local-test\"}"
```

`{"status":"accepted"}` and **no** `Meta CAPI …` line in the Worker output means Meta replied
`events_received: 1`. The code only logs on failure.

Run it again with the same number to confirm `duplicate` sends nothing, and once more with a
different number to confirm a second Lead.

The automated tests cover the same ground with a fake Graph API and need no token:

```bash
npm test --workspace=@bionex/worker
```

## Verifying in production

1. Submit one real order on the live site, with a **phone number not used today**.
2. Telegram must show it.
3. Events Manager → **Overview**. Two traps:
   - the date range defaults to a window that **ends yesterday** — include today;
   - events can take **up to 30 minutes** to appear.
4. In the `Lead` row, the **Integration** column should list the Conversions API next to the
   Meta Pixel, and the total should go up by **one**, not two.

If a Lead never arrives, watch the Worker live and submit another order:

```bash
npx wrangler tail --format pretty
```

`Meta CAPI refused the Lead (…)` quotes Meta's own error (it names the bad field and never
echoes the token). `Meta CAPI unreachable` means the request timed out (5 s).

> `LEADS_PER_IP_PER_DAY` is 3: one network may order for only three different numbers a day.
> While testing you will hit this — switch to mobile data for another IP.

## Turning it off

Delete either secret and redeploy; nothing else changes.

```bash
npx wrangler secret delete META_CAPI_TOKEN
```

## Status — 2026-10-16

- ✅ Code written, 30/30 Worker tests pass, typecheck clean.
- ✅ Verified locally against the real Graph API with `META_TEST_EVENT_CODE=TEST94281`:
  new number → Lead sent; same number again → `duplicate`, nothing sent; another number →
  Lead sent. No errors.
- ✅ Both secrets set in Cloudflare (5 total).
- ✅ Deployed 2026-10-16 05:29 UTC, version `534012de-77b7-47f8-918c-b19cfaaa3850`.
  `index.html` and both JS bundles are byte-identical to what was live before, so only the
  Worker changed — the page itself was untouched.
- ⏳ **Open:** confirm in Events Manager that a live order shows the Conversions API in the
  `Lead` row's Integration column. Blocked only by the date-range and 30-minute traps above.

Rollback if needed: `npx wrangler rollback`.

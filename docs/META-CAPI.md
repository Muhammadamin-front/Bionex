# Meta Conversions API (server-side Lead events)

An order is reported to Meta from the Worker, and **only after an operator has rung the
customer** and pressed an outcome button. The browser's Pixel no longer reports orders at all
while this is configured.

Why it works that way. Of the first 8 leads this campaign bought, 5 were not customers: people
who left a number for the free consultation the page offered and then told the operator they
had never ordered anything, and children. Every one of them had been reported to Meta as a
`Lead`, which is exactly the instruction "find me more people like this" — so the ads went
looking for more of them, and the cost per *real* lead was about three times what the
dashboard showed. No captcha or rate limit can fix that, because the submitters are real
humans. The only thing on this site that can tell a customer from a time-waster is the
operator on the phone, so the operator's button press is now the conversion signal.

The server copy is also the only reliable one: the browser's `fbq` is lost whenever an ad
blocker, a privacy browser or iOS tracking protection stops it loading, and a large share of
this campaign's traffic arrives through Instagram's in-app browser.

```
Visitor submits the form
        │
        └─► POST /api/leads ──► LeadRegistry ──► Telegram group        (immediately)
                                    │
                                    └─ meta_pending: hashes + _fbp/_fbc + IP + UA
                                          (held, nothing sent)
                                                │
Operator calls, presses a button  ──────────────┤
                                                │
          ✅ Сотилди  → Lead + Purchase ────────┤
          ❌ Рад этди → Lead ───────────────────┴─► graph.facebook.com  ← this document
          🔁 Кўтармади  → keeps waiting               event_id = submissionId
          ⏰ Кейинроқ   → keeps waiting               event_time = when they ordered
          🚫 Спам       → dropped, never sent
```

The browser Pixel still loads and still reports `PageView`, `ViewContent` and
`InitiateCheckout`, but it has no `Lead` at all — there is no code path, not even a fallback
for missing credentials. That fallback used to exist (`track: true` in the answer to
`POST /api/leads`) and it is what put browser-side `Lead` events into the dataset: they fire
for every filled-in form, including the ones an operator later marks spam, and an event once
sent cannot be taken back. A missing `META_PIXEL_ID`/`META_CAPI_TOKEN` now means no `Lead`
rather than a bad one, so check `meta: true` in `GET /api/health` after deploying.

So one order is one `Lead`, from one place, keyed to the order's `submissionId`.

## Files

| File | What |
|---|---|
| `apps/worker/src/meta.ts` | `buildUserData()` (at submit) and `sendMetaEvent()` (later) |
| `apps/worker/src/index.ts` | builds the match data in step 4 of `fetch`; sends nothing |
| `apps/worker/src/registry.ts` | `meta_pending` table, and `reportToMeta()` called from `button()` |
| `apps/web/src/lib/pixel.ts` | `PageView`/`InitiateCheckout` only, and never on localhost |
| `apps/worker/test/worker.test.ts` | `describe('the Lead event sent to Meta once an operator confirms the order')` |

## When it fires

| Operator presses | Sent to Meta |
|---|---|
| ✅ Сотилди | `Lead`, and `Purchase` with the order's value when `META_ORDER_VALUE` is set |
| ❌ Рад этди | `Lead` — a real person who answered and said no is still who the ads should find |
| 🔁 Кўтармади | nothing *yet*: the order keeps waiting for the next call |
| ⏰ Кейинроқ | nothing *yet* either — the customer answered and asked to be rung later, which is a real person but not yet an answer |
| 🚫 Спам | nothing, ever |
| nobody presses anything | nothing — the daily report counts these as «📣 Натижаси белгиланмаган» |

Meta has no field for "that lead was fake", and no way to upload a spam count. Withholding
the event **is** the signal: the numbers it never sees are the ones it stops looking for.
That is why 🚫 Спам has to be pressed and not merely ignored — an ignored order is
indistinguishable from an order nobody got round to, and both teach the ads nothing.

### Purchase

`✅ Сотилди` sends a second event, `Purchase`, carrying `value` and `currency` — but only if
`META_ORDER_VALUE` says what one sold order is worth. Unset, no `Purchase` is sent at all,
because a value Meta can optimise towards had better not be a guess.

`Lead` and `Purchase` are two different claims — "a real person" and "a paying person" — so
both are sent and kept apart. The `Purchase` carries `"<submissionId>-purchase"` as its
`event_id`, so Meta's de-duplication never folds the pair into one event.

Send it now, optimise for it later: at $10/day the campaign produces one or two sales a week,
far short of the ~50 conversions an ad set needs weekly to leave the learning phase, so moving
the ad set's optimisation event onto `Purchase` today would starve it. Collect the history
first; the switch is then a setting, and the past data is already there to support it.

Whether Turnstile passed no longer decides this. An order marked "⚠️ «бот эмасман» текшируви
ўтмади" (see [TURNSTILE.md](TURNSTILE.md#5-if-the-check-cannot-finish)) is reported like any
other once an operator vouches for it — on old phones and in in-app browsers the check often
cannot finish, and the operator who spoke to the customer is the better judge.

`event_time` is **when the customer ordered**, not when the button was pressed, so Meta
attributes the lead to the right ad and the right day. Meta refuses events older than 7 days,
so an order nobody marks within a week is dropped (`meta_pending` is pruned) and only ever
appears in the operators' own numbers.

A repeat of the same phone number inside `DUPLICATE_WINDOW_HOURS` answers `duplicate`: the
customer still sees a friendly message and the operators still get a 🔁 note, but it never
becomes a second order, so there is nothing to report. One customer must not become two leads.

The send runs inside `waitUntil()`, so it never delays the operator's toast, and a failure is
logged and dropped — the outcome is already saved and the group message already updated. Meta
is never allowed to break an order or an outcome. It is sent at most once per order: the
`meta_pending` row is deleted as the event goes out, so pressing the button again, or changing
the outcome afterwards, cannot produce a second `Lead`.

### What this costs

Meta's optimisation needs roughly 50 conversions per ad set per week to leave the learning
phase, and reporting only confirmed leads makes the number it sees smaller — in exchange for
it being true. It also arrives later (as late as the operator's call), which Meta tolerates
within the 7-day window. The leverage is now in the operators' hands: **an order nobody marks
teaches the ads nothing**, which is why the daily report names that number.

## What is sent to Meta

| Field | Value |
|---|---|
| `event_name` | `Lead`, and `Purchase` alongside it when a sold order has a value |
| `event_id` | the order's `submissionId` (de-duplication with the Pixel); the `Purchase` adds a `-purchase` suffix |
| `event_time`, `event_source_url`, `action_source` | timestamp, the page, `website` |
| `user_data.ph` | **SHA-256** of the phone number, digits only (`998901234567`) |
| `user_data.fn`, `.ln` | **SHA-256** of the first and last name, lower-cased |
| `user_data.country` | **SHA-256** of `uz` |
| `user_data.client_ip_address`, `.client_user_agent` | from the request |
| `user_data.fbp`, `.fbc` | the `_fbp` / `_fbc` cookies, read from the request's `Cookie` header |
| `custom_data` | `content_name: Zeynara`, `content_category: Health Supplement`; plus `value` and `currency` on a `Purchase` |

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

A third, optional secret turns the `Purchase` event on:

```bash
printf "349000" | npx wrangler secret put META_ORDER_VALUE   # what one sold order is worth
printf "UZS"    | npx wrangler secret put META_CURRENCY      # optional, UZS is the default
```

Use the average revenue of a sold order, not the list price — Meta is going to treat this
number as the thing worth maximising. Leave it unset until you know it; no `Purchase` is
better than a wrong one, and the number can be changed later without losing anything.

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

`{"status":"accepted"}` and **nothing** in the Test events tab: correct. The
order is only parked. Now press the operator's button yourself. The webhook's secret is derived
from the bot token, so you can compute it:

```bash
TOKEN=$(grep -oE '^TELEGRAM_BOT_TOKEN *= *"?[^"]+' .dev.vars | sed 's/.*= *"\?//')
CHAT=$(grep -oE '^TELEGRAM_CHAT_ID *= *"?[^"]+' .dev.vars | sed 's/.*= *"\?//')
SECRET=$(printf "zeynara-webhook:%s" "$TOKEN" | openssl dgst -sha256 -hex | awk '{print $NF}')

curl -s -X POST http://127.0.0.1:8787/api/telegram/hook \
  -H "x-telegram-bot-api-secret-token: $SECRET" \
  -H 'content-type: application/json' \
  -d "{\"callback_query\":{\"id\":\"1\",\"from\":{\"id\":1,\"first_name\":\"Тест\"},\"data\":\"s:1:sold\",\"message\":{\"message_id\":1,\"text\":\"🆕\",\"chat\":{\"id\":$CHAT,\"type\":\"supergroup\"}}}}"
```

`s:1:sold` is lead **1** — the first order in a fresh local database. Now the Test events tab
shows one `Lead`, timed when the order was submitted, not when you ran this. The Worker logs
nothing on success.

Worth confirming by hand, since each is a way to waste ad money:

- `s:1:spam` instead → still nothing in Test events, ever.
- the same curl twice → still one `Lead` (the `meta_pending` row is gone after the first).
- the same phone number again within 24 h → `"duplicate"`, no second order and nothing to send.

The automated tests cover the same ground with a fake Graph API and need no token:

```bash
npm test --workspace=@bionex/worker
```

## Verifying in production

1. Submit one real order on the live site, with a **phone number not used today**.
2. Telegram must show it. Events Manager must **not** — this is the new part.
3. Press ✅ Сотилди (or ❌ Рад этди) under it.
4. Events Manager → **Overview**. Two traps:
   - the date range defaults to a window that **ends yesterday** — include today;
   - events can take **up to 30 minutes** to appear.
5. In the `Lead` row, the **Integration** column should list the Conversions API next to the
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

## Status

**2026-10-19 — the operator's button became the conversion signal.** Deployed, version
`5e2d0f0e-82d5-462c-992f-9dbb030047bb`.

- ✅ `meta_pending` holds the match data; `reportToMeta()` sends on ✅/❌ only.
- ✅ Also fixed here: 🚫 Спам had never worked in the Telegram group — the `callback_data`
  pattern in `index.ts` omitted `spam`, so the button answered "Бу тугма ишламайди." It is the
  operators' only defence against the fake orders (see [SPAM.md](SPAM.md)) and it is now the
  button that keeps an order away from Meta, so it had to work.
- ✅ Typecheck clean for all three workspaces.
- ✅ Tests and the strict production build ran on the Mac as part of `npm run deploy` (the script
  chains them with `&&`, so the deploy proves they passed). 4 assets uploaded, 15 unchanged;
  worker startup 12 ms; cron `0 15 * * *` re-registered.
- ⏳ **Open:** walk the five steps under "Verifying in production".

**2026-10-19 — the ad finally has a destination.** The campaign had been sitting on "No ads"
because its only ad was a never-published draft, and that draft had **Call to action = No button**
with no website URL — an existing-Instagram-post creative carries no link of its own, so nobody
could have reached the form and no `Lead` could ever have fired. Set CTA to **Order now** →
`https://zeynara.8pj6jsdbgr.workers.dev/`, added the URL parameters from
[TARGETING.md](TARGETING.md) §7, renamed the ad to `Zeynara | Qon-bosimi | sayt-lid`, published.
Campaign delivery is now **In review**.

An older ad under the same ad set (`120253232425190134`) is archived; Meta rejects writes to it
with Graph API `#100.33` / `#1885088`. Its stale draft was discarded. The live ad is
`120253238595780134`.

**2026-10-19 — a second creative went live as its own campaign.** The Oct 18 Reel
(`18233749177324762`) was duplicated into campaign `120253238722560134` → ad set
`120253238722570134` → ad `120253238722580134`, same name `Zeynara | Qon-bosimi | sayt-lid`.
Two things did not survive the duplication and had to be fixed by hand:

- **Location expansion came back on.** "Reach more people likely to respond to your ads" was
  checked again, which quietly re-adds Toshkent and pushed the estimate to 6.9–8.1M. Unchecking it
  brought it back to the correct **5.1–5.9M**. The 12 regions themselves had copied fine — so the
  audience-size number, not the region list, is the thing to check after any duplicate.
- **`#2446880` "WhatsApp number required"** sat in the right rail the whole time. It is *not* a
  publish blocker: the destination is clean (Website URL set, Browser add-ons = None, CTA = Order
  now) and Platforms are Facebook / Instagram / Audience Network / Threads with 0 excluded
  placements. It only means the ad won't serve to one WhatsApp-dependent placement out of 18,
  because the Page has no WhatsApp number connected. Published over it.

Daily spend is now **$20** ($10 per campaign) — confirmed before publishing, so the two creatives
can be compared side by side.

**2026-10-16 — the server-side copy went live.** Deployed 05:29 UTC, version
`534012de-77b7-47f8-918c-b19cfaaa3850`; the page's `index.html` and JS bundles were untouched.
Verified locally against the real Graph API with `META_TEST_EVENT_CODE=TEST94281`. Both secrets
are set in Cloudflare (5 total). At that point every form fill was reported, which is the
problem the 2026-10-18 change exists to fix.

Rollback if needed: `npx wrangler rollback`.

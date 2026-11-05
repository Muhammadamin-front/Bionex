# The fake orders

Most of the junk on this site is not a bot. A former employee who left on bad terms fills the
form in by hand, from his own phone, with real-looking names and real-looking numbers. Of the
first 8 leads the campaign bought, 5 were not customers.

That one fact decides every defence below. A captcha asks "are you a human?", and the honest
answer here is yes — so Turnstile, stricter validation and bigger rate limits cannot stop him.
Only two things can: **making each fake order cost him time**, and **making sure a fake order
changes nothing downstream** — no Meta Lead, no operator's afternoon.

## What he cannot do

| | Why |
|---|---|
| Send hundreds of orders | `IP_ORDERS_PER_HOUR` = **3** attempts per hour per IP — failed attempts included |
| Send many numbers from one network | `LEADS_PER_IP_PER_DAY` = **3** different numbers a day |
| Re-send one number to make noise | the same number inside `DUPLICATE_WINDOW_HOURS` (24 h) is one order plus a 🔁 note |
| Hammer one number | `PHONE_REQUESTS_PER_HOUR` = 5, in `registry.ts` |
| Teach the ads to find more of him | nothing reaches Meta until an operator confirms a real person answered — see [META-CAPI.md](META-CAPI.md) |
| Hide that a burst came from one place | every suspicious order shows `🔎 Манба #a1b2c3 (бугун 3 та рақам)` |
| Change network to shake off a spam mark | the browser keeps a random id (`apps/web/src/lib/device.ts`) and 🚫 marks it too: his next order says «бу қурилмадан аввал спам белгиланган» on any network, until he clears the site's data or uses a private window |

On the main site these limits count the network again since 2026-11-04 (the owner's call, comparing
with 25–28.10); from 2026-10-29 they counted only the browser's own id, which a script can replace on
every post. The partner site still counts the phone, with the network capped at 30. Every refusal shows
in the 20:00 report: **watch that line**, because a customer behind a busy mobile address can be refused.

**`IP_ORDERS_PER_HOUR` is 3 on purpose.** It is the only cap that costs him anything per
attempt, so it is also the one that looks like a mistake when a real customer mistypes a number
three times and is told "too many attempts". Do not raise it while this is going on. If
customers do complain, raise `LEADS_PER_IP_PER_DAY` first — it gives retries without giving him
more numbers — or point them at the Telegram bot, which is not subject to the per-IP cap.

## What the operators do

The 🚫 **Спам** button is the weapon, and it is theirs alone — the code cannot tell a real
customer from this man, and the operator on the phone can.

Pressing it does three things:

1. The order is never reported to Meta. ✅ Сотилди and ❌ Рад этди are; 🚫 Спам never is, and
   neither is an order nobody presses anything on.
2. The order's network and device are remembered for **30 days** (`spam_marks`, as hashes).
   The next order from either arrives marked ⚠️ «бу манбадан / бу қурилмадан аввал спам
   белгиланган», so the operator knows before dialling. «Keraksiz» in the partner site's Google
   Sheet does the same ([PARTNER-SITE.md](PARTNER-SITE.md)), and the marks count on both sites.
3. It counts in the 20:00 report, so the scale of the sabotage is visible day by day.

> The button did nothing in the Telegram group until 2026-10-18 — `index.ts` matched
> `sold|noanswer|rejected` in the `callback_data` and left `spam` out, so 🚫 answered "Бу тугма
> ишламайди." (It worked in the Mini App panel.) Fixed. This is probably why nobody knew
> whether the 5 fake orders carried ⚠️ flags: the memory that marks them had never been filled.

An order nobody marks is the worst case: it teaches the ads nothing and warns nobody. The daily
report names that number — «📣 Натижаси белгиланмаган: N та».

## The marks on an order

`FLAG_TEXT` in `telegram.ts`. None of them refuses an order; all of them are hints for the call.

| Flag | Shown as | Means |
|---|---|---|
| `spam_source` | бу манбадан аввал спам белгиланган | an operator pressed 🚫 on an order from this network within 30 days |
| `spam_device` | бу қурилмадан аввал спам белгиланган | 🚫 (or «Keraksiz») on an order from this browser within 30 days, whatever its network now |
| `spam_lookalike` | аввал спам бўлган қурилмага ўхшайди | the browser id is new (data cleared, private window) but the phone's likeness (`deviceFingerprint`: user agent, screen, languages, time zone, CPU, graphics, a canvas drawing) matches a marked order. Phones of the same model and system can share it, so it is a hint for the operator, never a refusal |
| `multi_phone_ip` | бу манбадан бугун бир нечта рақам юборилди | more than one number from this network today |
| `phone_pattern` | рақам сунъийга ўхшайди | e.g. 90 111 11 11 |
| `honeypot` | яширин майдон тўлдирилган | one of two hidden decoy fields («fax», «website») was filled — only a script does that |
| `bot_trap` | бот тузоғига тушди | the browser saw a made-up click (`isTrusted: false`), a touch screen nobody touched before sending (`taps: 0`), or says a program drives it (`webdriver`). Hidden from the panel and the partner sheet. Old cached pages send no count and are never caught |
| `likely_bot` | Instagram/Facebook орқали эмас — бот эҳтимоли бор | a failed check outside the ads' in-app browser, **including sending no token at all from a plain browser** (which is asked for one since 2026-10-31). Real customers were found among these (2026-10-24), so it is a warning only and stays visible — but on the main site it routes the order to the «Spam» tab and withholds the instant Meta Lead |
| `no_captcha` | «бот эмасман» текшируви ўтмади | inside the Instagram / Facebook app, where the main site asks for no check, this cannot be set. Elsewhere it is a check that was asked for and not answered |

## The main sheet's «Sabab» column

Short codes for filtering, one row per order. Compare each code with what the operators marked in
«Holat» before making any of them stricter. «Status» is `ok` when the order was reported as a Lead at
once, `shubhali` when it waits for a person. No code refuses an order.

| Code | Means | Decides anything? |
|---|---|---|
| `honeypot` / `bot_tuzoq` / `brauzersiz` | a decoy filled with a program's signs / a program's signs / a direct post with no page (no browser signals and no token Cloudflare accepted: a made-up token does not hide it) | «Spam» tab, never Meta |
| `honeypot_avto` | a decoy filled with no program's signs: perhaps a person's autofill | warning |
| `captcha_fail` + `instagramdan_emas` | a plain browser that did not pass the check | «Spam» tab, no instant Lead |
| `captcha_savol_ilova` | inside the app, the silent check wanted a person to act. **This one says what asking there would cost** | **nothing yet: being measured** |
| `captcha_fail_ilova` | inside the app, Cloudflare refused the token | **nothing yet: being measured** |
| `captcha_yoq_ilova` | inside the app, no token and no reason: sent before it was ready, an old cached page (the first days after a deploy), or a script claiming to be the app | **nothing yet: being measured** |
| `captcha_xato_ilova` | inside the app, the check itself failed to run | **nothing yet: being measured** |
| `tez_yuborish` | under 20 s on the page or 12 s filling the form | «Spam» tab, no instant Lead |
| `spam_qurilma` / `spam_raqam` / `spam_oxshash` | this phone / number / a look-alike was marked spam | «Spam» tab, no instant Lead |
| `havola_takror` | this ad click was behind another number's order | no instant Lead |
| `spam_tarmoq`, `kop_raqam`, `soxta_raqam`, `avto_raqam`, `havola_tashqarida`, `dastur_bosgan` | warnings | nothing |
| `fbclid_yoq` | no ad click id | nothing |

A repeat of a number within 24 h adds no row: it is noted in «Takror» on the order's own row.

## The honest limits

Uzbek mobile networks put thousands of customers behind one address and move customers between
addresses, so the per-IP memory is a speed bump, not a wall. He can switch to mobile data, to
Wi-Fi, to a VPN, and arrive as a new "source" each time. There is no fix for that in the page;
there is only making the fake order worthless, which is now done.

If it gets worse, in rough order of cost to real customers:

- a Cloudflare **WAF rate-limit rule** on `POST /api/leads` (free plan allows one) — it acts
  before the Worker runs, so his attempts stop costing anything at all. It needs the site on
  **its own domain**: WAF rules belong to a zone, and `workers.dev` / `pages.dev` are not ours;
- Cloudflare **Bot Fight Mode** / a managed challenge on the order path;
- during a burst, accept orders only through the Telegram bot, where a shared contact proves
  the number belongs to the sender;
- if he is identifiable and it is damaging the business, that is a matter for a lawyer, not for
  `wrangler.jsonc`.

## Reading the damage

The 20:00 report to the group counts orders, sold, spam, repeats and unmarked. Spam as a share
of orders is the number to watch; cost per **confirmed** lead in Events Manager is the number
that decides whether the campaign works, and since 2026-10-18 it is finally the number Meta
optimises for.

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
| `multi_phone_ip` | бу манбадан бугун бир нечта рақам юборилди | more than one number from this network today |
| `phone_pattern` | рақам сунъийга ўхшайди | e.g. 90 111 11 11 |
| `honeypot` | яширин майдон тўлдирилган | a field only a script fills |
| `no_captcha` | «бот эмасман» текшируви ўтмади | common on old phones and in Instagram's in-app browser — **not** evidence of anything |

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

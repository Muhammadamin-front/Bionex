# Operator-confirmed Conversions API

The pattern: the browser never fires the conversion event. The server fires it, once,
after a human has confirmed the lead is real.

## Why not just fire it from the pixel

A browser pixel fires on form submit, which is the moment you know the *least* about
the lead. On a product sold by phone call, a large share of submissions are people
after free advice, curious children, mistyped numbers, and — if someone has a motive —
deliberate fakes. Every one of those used to become a `Lead`, so Meta's optimizer went
looking for more people like them. The spend looked fine and the sales didn't come.

Gating the event on operator confirmation inverts this: Meta's training signal becomes
"people who answered the phone and said yes."

The cost is latency (hours, not seconds) and volume (fewer events, so the learning
phase takes longer). Both are worth it. Be upfront with the user about the volume
tradeoff so a slow first week doesn't look like a bug.

## Mapping outcomes to events

Operators produce more than two outcomes, and the mapping is where most of the thinking
goes. A workable default:

| Outcome | Sent | Why |
|---|---|---|
| sold | `Lead` + `Purchase` | both claims are true, and they are different claims |
| rejected (answered, said no) | `Lead` | a real person who can be reached is still the target |
| no answer | nothing *yet* | not a judgement; keep the order pending for the next call |
| asked to be called later | nothing *yet* | answered the phone, hasn't decided — pending too |
| spam / fake | nothing, ever | |

The two "pending" rows matter more than they look. An outcome that is a to-do rather than
a result needs its own button, or operators will press the nearest wrong one — and once a
terminal outcome is recorded, the order leaves the queue and the real outcome is never
reported. Give "ring me later" a button, a tab in the panel, and a line in the daily
report; it is the only status that is a worklist.

**There is no negative event.** No API field says "that lead was fake", and no endpoint
accepts an aggregate spam count. Withholding the event *is* the signal — the numbers Meta
never sees are the ones it stops looking for. Two consequences worth telling the user:
marking spam has to actually happen (an unmarked order is indistinguishable from an
unworked one, and both teach nothing), and the only way to actively push back is a
phone-number Custom Audience set to **Exclude**.

Don't confuse Event Match Quality with lead quality. EMQ scores the identity fields
(`ph`, `fn`, `fbc`…) — how confidently Meta can match the event to a person. It says
nothing about whether that person was a real customer.

### Purchase alongside Lead

Send `Purchase` with `value` and `currency` on a sale, as a separate event with its own
`event_id` (suffix the submission id) so de-duplication doesn't fold the pair into one.

Two cautions. First, the value must be real — an average order value the business
actually knows. Meta treats it as the quantity to maximise, so a placeholder is worse
than sending no `Purchase` at all; make the event conditional on the value being
configured. Second, *sending* the event and *optimising for* it are separate decisions.
A campaign producing one or two sales a week is far below the ~50 weekly conversions an
ad set needs to leave the learning phase, so switching the optimisation event to
`Purchase` would starve it. Send now, accumulate history, switch later — at which point
the past data is already there.

## Shape of the flow

```
Browser                    Server                      Operator            Meta
   │                          │                           │                  │
   ├─ PageView ──────────────────────────────────────────────────────────────►
   ├─ ViewContent ───────────────────────────────────────────────────────────►
   │
   ├─ POST /api/leads ───────►│
   │  (name, phone, utm,      │ store order, keep
   │   fbp, fbc, submissionId)│ user_data pending
   │                          ├─ notify ─────────────────►│
   │                          │                           │ calls the number
   │                          │◄── "confirmed" ───────────┤
   │                          │
   │                          ├─ Lead (Conversions API) ────────────────────►│
```

Note what the browser *does* send: `fbp` and `fbc` cookies, and the submission id.
The server can't reconstruct those later, so capture them at form-submit time and
store them with the pending order.

## De-duplication

If you ever fire the same conversion from both the browser and the server, give both
the same `event_id` so Meta collapses them. Use a value you already have per
submission — a `submissionId` works well, since it's unique per form fill and
available on both sides.

In a gated setup the browser never fires `Lead`, so de-duplication isn't strictly
needed — but keeping `event_id` stable still protects you against double-sending when
an operator clicks confirm twice, or when a retry fires after a timeout. Make the
server side idempotent on `event_id`.

## The event body

```jsonc
{
  "data": [{
    "event_name": "Lead",
    "event_time": 1760000000,          // unix seconds, must be within 7 days
    "event_id": "<submissionId>",
    "event_source_url": "<the landing page URL>",
    "action_source": "website",
    "user_data": {
      "ph": "<sha256>",                 // digits only, country code, no + or spaces
      "fn": "<sha256>",                 // lowercase, trimmed
      "ln": "<sha256>",                 // omit the key entirely if unknown
      "country": "<sha256 of 2-letter code, lowercase>",
      "client_ip_address": "<raw>",     // NOT hashed
      "client_user_agent": "<raw>",     // NOT hashed
      "fbp": "<raw>",                   // NOT hashed
      "fbc": "<raw>"                    // NOT hashed
    }
  }]
}
```

POST to `https://graph.facebook.com/<version>/<PIXEL_ID>/events` with the CAPI access
token.

Hashing rules worth getting right, because a wrong one silently lowers match quality
rather than erroring:

- Normalize **before** hashing: lowercase, strip surrounding whitespace, strip all
  non-digits from the phone (including the leading `+`).
- Hash with SHA-256, hex, lowercase.
- `client_ip_address`, `client_user_agent`, `fbp` and `fbc` are sent **raw**. Hashing
  them makes them useless.
- Omit a key entirely rather than sending an empty string or a hash of `""`.
- Names in non-Latin scripts hash fine — lowercase them the same way.

## Verifying it works

In Events Manager, the honest test is a real order, because test events take a
different path:

1. Submit a real order with a phone number you haven't used before.
2. Confirm the order appears in your CRM/Telegram **and that Events Manager shows
   nothing yet.** This is the step that proves the gate is closed.
3. Have the operator mark it confirmed.
4. Open Events Manager → Overview, with today included in the date range, and allow
   up to 30 minutes.
5. Check two things on the `Lead` row: the **Integration** column lists the
   Conversions API, and the total went up by **one**, not two. Two means the browser
   pixel is still firing `Lead` as well.

Also look at **Event Match Quality** on the `Lead` event. Phone-verified leads push
this up noticeably, which is a concrete second reason to add SMS verification to the
form.

## Failure handling

The confirm click is a human action that shouldn't fail because Meta's API is slow.
Queue the event and retry rather than blocking the operator's UI, and surface a
visible alert if the queue backs up — a silently broken CAPI looks exactly like a
campaign that stopped working.

Keep a kill switch (an env flag) that skips sending. During incidents, a campaign
with no events is recoverable; a campaign trained on garbage events is not.

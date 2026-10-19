---
name: paid-ads
description: Operating Meta (Facebook/Instagram) ad campaigns through Ads Manager for lead generation — auditing campaign settings, duplicating ad sets safely, diagnosing why leads are fake or sales don't follow, wiring the Conversions API to fire only on operator-confirmed leads, and defending against deliberate fake-lead attacks. Use this skill whenever the user mentions Meta/Facebook/Instagram ads, Ads Manager, ad sets, campaigns, targeting, pixel, CAPI, Conversions API, lead quality, CPL, learning phase, spam leads, or asks to check/fix/duplicate/publish an ad — including in Uzbek or Russian ("kompaniyani tekshir", "reklama", "lid", "spam ko'payib ketyapti", "проверь кампанию", "лиды"). Also use it when someone asks whether Meta will refund ad spend, or why money was spent with no profit. Reach for it even when the request sounds like a one-off UI question, because most Ads Manager mistakes are invisible in the UI and this skill lists the specific tells.
---

# Paid ads (Meta) — operations

This skill covers running lead-generation campaigns on Meta through the Ads Manager UI,
where the real product is a *confirmed customer*, not a form submission. Most of what's
here was learned by making the mistake first. The recurring theme: **Ads Manager's
defaults quietly work against lead quality, and the damage is usually invisible unless
you know which number to look at.**

---

## The one idea that organizes everything

Meta optimizes for whatever event you send it. If you fire `Lead` on every form
submission, Meta learns to find people who fill out forms — which includes bots,
bored teenagers, and anyone deliberately sabotaging you. Spend goes up, sales don't.

So the single highest-leverage change in any lead-gen setup is: **send the conversion
event only after a human has confirmed the lead is real.** Everything else in this
skill is secondary to that.

Concretely: the browser pixel tracks PageView and ViewContent but *not* `Lead`. The
form submission goes to your backend, a human (operator/salesperson) calls the number,
and only when they mark it confirmed does the backend fire `Lead` through the
Conversions API. See `references/capi-gating.md` for the implementation pattern,
including event de-duplication and the field hashing Meta expects.

When a user complains "I got 7 leads and 0 sales", this is almost always the answer —
not targeting.

---

## Auditing a campaign

Work top-down: campaign → ad set → ad. Read with `get_page_text` on the editor's
**Review** tab rather than clicking through fields; it dumps every setting as text in
one call and avoids accidental edits.

### Audience size is the fastest diagnostic

Before reading any setting, look at **Estimated audience size** in the right rail.
Memorize what the correct number looks like for your targeting. If it's meaningfully
larger than expected, something is silently widening your audience — usually location
expansion or Advantage+ audience, both of which are on by default.

This beats reading the region list, because the region list can be perfectly correct
while the audience is still wrong.

### The settings that actually matter

| Setting | Where | What to want | Why |
|---|---|---|---|
| **"Reach more people likely to respond to your ads"** | Ad set → Locations, below the search box | **Unchecked** | Checked, it re-adds the exact places you excluded. The #1 silent geography killer. |
| Region rows | Ad set → Locations | Each picked as **Region**, never City, never Drop Pin | Cities and pins carry a `(+25 mi)` radius that bleeds across borders. |
| Advantage+ audience | Ad set → Audience | **Off** for strict geo/age requirements | It treats your targeting as a "suggestion" and overrides it. |
| Advantage+ leads campaign | Campaign recommendations rail | **Off** | Same, at campaign level. |
| Detailed targeting, Languages | Ad set | **Blank** | In small markets, interest targeting shrinks the pool faster than it improves it. |
| Age "Use as a suggestion" | Ad set → Age | **Unchecked** | Checked, your age range is advisory. |
| Conversion event | Ad set → Conversion | The event your CAPI actually sends | Optimizing for an event that never fires means no optimization at all. |
| URL parameters | Ad level → Tracking | Present and identical across ads | Without it you can't tell which creative produced which lead. |
| Advantage+ creative / Essential enhancements | Ad level | Identical across ads you're comparing | Otherwise a creative A/B test is really testing enhancements. |

### Things that look like errors but aren't

- **Graph API `#2446880` "WhatsApp number required"** — a per-placement warning, not a
  publish blocker. It pairs with "Your ad won't deliver to 1 placement" and just means
  the Page has no WhatsApp number for the WhatsApp-dependent placement. If your Website
  URL, CTA and platform list are set, publish over it.
- **Campaign row showing "No ads" right after publishing** — stale table cache. Check
  the **Ads** tab filtered to that campaign instead.
- **Delivery = "Processing" / "In review"** — normal lifecycle before Active.
- **"Location type" (People living in this location)** — Meta *removed* this control
  from Leads/conversion objectives. Older guides still tell you to set it. Don't hunt
  for it; the region row's `•••` menu now offers only "Exclude location".

### Phantom drafts

Opening an ad editor can create an unpublished draft ("Updated: Creative") **without
you changing anything** — the URL-parameters field re-saves itself. Publishing it
restarts the learning phase for no reason.

So after any read-only audit, check the **"Review and publish (N)"** button at the top
of the campaigns table. If N > 0 and you made no intentional edit, open it, confirm the
changes are the phantom kind, then Cancel and use **Discard drafts**.

---

## Duplicating a campaign or ad set

Duplication copies the region list correctly but **re-enables "Reach more people likely
to respond to your ads"**. This is the single most reliable regression. After every
duplicate:

1. Open the duplicate's Locations panel.
2. Check the expansion checkbox — uncheck it.
3. Confirm the audience estimate matches the original.
4. Compare Advantage+ creative / Essential enhancements against the original. "On by
   default" items live under **Essential enhancements**, which is collapsed; they don't
   show in the summary unless you expand it.
5. **Rename the ad set and ad.** A duplicate keeps the original names, so
   `{{adset.name}}` and `{{ad.name}}` resolve identically for both — and your analytics
   can't tell the two creatives apart.

Then publish once and leave it alone.

---

## Learning phase discipline

An ad set needs roughly 50 conversions per week to exit learning. Every meaningful edit
resets it. This has two practical consequences people get wrong:

**Deploy first, publish once, then don't touch for 7 days.** Make every change in one
sitting — tracking, targeting, creative — and publish as a single batch. A week of
small daily "improvements" is a week of an ad set permanently in learning.

**Don't split a small budget across ad sets.** Two ad sets at $10/day each will usually
leave *both* below the conversion threshold. One ad set at $20 has a chance. If the user
wants to compare two creatives, be honest that on a small budget this costs them
optimization, and suggest running them sequentially or accepting a slower read.

The one safe window to edit is immediately after publishing, before the ad set has
delivered anything — spend of $0.00 means there's no learning to reset yet.

---

## Tracking that lets you answer "which ad worked"

Ad level → Tracking → URL parameters:

```
utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&fb_placement={{placement}}
```

Meta substitutes the names *as they were at publish time*, so renaming later doesn't
retroactively fix old data — another reason to name things properly before publishing.

Name campaigns, ad sets and ads so that the three macros are distinguishable from each
other. A useful shape: `Brand | Market | Angle` for the campaign, `Geo | Age | Theme`
for the ad set, `Brand | Creative-ID | Destination` for the ad.

**Duplicating a campaign quietly breaks this.** The copy keeps the original's ad set and
ad names, so `{{adset.name}}` and `{{ad.name}}` resolve to the same string in both, and
every lead from either one looks identical downstream. The dashboard still separates them
by id, but the CRM — which only sees the URL — cannot.

So for the one field that has to be unambiguous, don't use a macro at all: give each ad a
short hardcoded `utm_content` (`old-video`, `new-reel`). It cannot collapse, it cannot be
broken by a rename, and it reads better in a CRM message than a 36-character name. Keep
the macros for the rest, where a collision costs nothing.

If the CRM is the thing that has to tell two campaigns apart, check its own capture code
too. A `utm_term` the ad sends and the landing page never reads is as good as absent, and
a field stored but never displayed is just as invisible to the person on the phone.

---

## Lead quality and deliberate spam

Distinguish two problems that look identical in the dashboard:

**Low-quality leads** — wrong geography, wrong age, curiosity clicks. Fix with
targeting and with CAPI gating, which stops Meta from learning the wrong pattern.

**Deliberate sabotage** — a competitor or ex-employee submitting fake leads by hand.
Captchas and bot detection don't help, because it's a human. Rate limits only slow
them down.

The defenses, in increasing order of effectiveness and cost:

1. **Per-IP and duplicate-window caps** in the backend. Cheap, catches the lazy version.
2. **An explicit "spam" action in whatever CRM the operator uses**, which both suppresses
   the CAPI event and remembers the source. Insist that operators actually use it — an
   order nobody marks is the worst case, because it teaches nobody anything.
3. **A Custom Audience of the spam phone numbers, set to Exclude on the ad set.**
   Upload a CSV with a `phone` header in E.164-without-plus form (`998901234567`);
   needs ~100 numbers minimum and up to 24 h to process.
4. **An edge rate-limit rule on the form endpoint** (e.g. Cloudflare WAF on
   `POST /api/leads`), which runs before your application code.
5. **SMS verification on the form.** This is the strongest measure by a wide margin —
   it forces the attacker to own a real SIM per fake lead — and it has a side benefit:
   a verified phone improves the `ph` match quality of your CAPI events.

Recommend SMS verification early. People tend to treat it as a last resort when it's
actually the thing that ends the problem.

---

## When someone asks Meta for a refund

Be direct and factual rather than hopeful. Meta does not refund ad spend because a
campaign was unprofitable, because leads turned out fake, or because a competitor
sabotaged the funnel. The ads were delivered; the service was rendered.

Meta will look at: billing errors (duplicate or wrong-amount charges), unauthorized
charges (compromised account), and delivery failures caused by a fault on Meta's side.
The route is Billing & payments → the transaction → report a problem / dispute.

Pull the actual spend figure before answering — it reframes the conversation. People
often ask about a refund for an amount that's smaller than an hour of their time.

Note that you're not a financial or legal advisor, and move the conversation to what
actually recovers the money: fixing the signal so the *next* spend converts.

---

## Driving the Ads Manager UI

Ads Manager is a heavy React app that loses state easily. These rules prevent most
lost work:

- **Never press Escape** in an editor — it can close the panel and drop unsaved edits.
- **"Refresh your screen" modal → press Close, never Refresh.** Refresh discards the
  in-memory draft.
- **Never click an Advantage+ "Apply now" nudge** in the recommendations rail. It turns
  Advantage+ audience on and overrides your geography.
- **"Discard draft" (ad level) ≠ "Discard drafts" (account level).** The first throws
  away the editor you're in; the second clears every unpublished change in the account.
  Use the second deliberately, for phantom drafts.
- **Closing the last tab in a browser tab group destroys the group**, taking any other
  tab — including an open editor with unsaved state — with it.
- If a tab won't close because of a `beforeunload` guard, clear it
  (`window.onbeforeunload = null`) then close.
- Prefer stable **standalone editor URLs** over clicking through the table:
  `.../manage/ads/edit/standalone?act=<ACCOUNT>&business_id=<BIZ>&selected_ad_ids=<AD>&selected_adset_ids=<ADSET>&selected_campaign_ids=<CAMPAIGN>`
- Spend and results columns are far to the right of the campaigns table; drag the
  horizontal scrollbar rather than scroll-wheeling, and wait for cells to load.

---

## Working with the person

Lead-gen advertisers are usually spending their own money and are often not native
English speakers. Two habits matter:

**Say what you changed and what you deliberately didn't.** An audit that reports "all
good" is less useful than one that lists the four things that are fine *and* the one
that isn't. Name the setting, where it lives, and what it costs them.

**Separate "wrong" from "suboptimal".** A publish-blocking error, a silently widened
audience, and a naming inconsistency are three very different urgencies. Say which is
which, and say plainly when something can't be fixed (a removed UI control, a
non-refundable charge) instead of sending them looking for it.

Record what you find in the project's own docs if it has them — the next audit is
cheaper when last audit's findings are written down.

---

## Reference files

- `references/capi-gating.md` — the operator-confirmed Conversions API pattern:
  event de-duplication with `event_id`, which user fields to hash, what to send from
  the browser vs. the server, and how to verify in Events Manager.
- `references/audit-checklist.md` — a terse pass/fail checklist to run against a live
  campaign, in the order that catches the most expensive mistakes first.

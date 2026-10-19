# Live campaign audit checklist

Run top to bottom. The order is deliberate: the first four checks catch the mistakes
that cost real money, and each takes seconds. Everything after #7 is about being able
to *read* your results later, which matters but doesn't burn budget today.

Read settings from the editor's **Review** tab with `get_page_text` — one call, every
field as text, no accidental clicks. Finish with the phantom-draft sweep at the end.

---

## Money-losing mistakes (check these first)

**1. Estimated audience size** — Ad set → right rail.
Compare against the number you know is correct for this targeting. Larger than expected
means something is widening the audience silently. This single number catches more than
reading every field below.
→ Record the expected range in the project's docs so the next audit is a glance.

**2. "Reach more people likely to respond to your ads"** — Ad set → Locations, below
the search box.
Must be **unchecked**. Checked, it re-adds the exact places you excluded. Re-enables
itself on every duplicate.

**3. Region rows** — Ad set → Locations.
Every row must be a **Region**. A City or Drop Pin row carries `(+25 mi)` and bleeds
across borders. Scan for the `+25 mi` string; its absence is the pass condition.

**4. Advantage+ audience** — Ad set → Audience.
**Off** if you have hard geo or age requirements. On, it treats your targeting as a
suggestion. Also check **Advantage+ leads campaign** in the campaign recommendations
rail, which does the same thing one level up.

**5. Conversion event** — Ad set → Conversion.
The event selected must be the one your CAPI actually sends. Optimizing for an event
that never fires is no optimization at all. Verify against Events Manager, not against
memory.

**6. Age "Use as a suggestion"** — Ad set → Age.
Unchecked, or your age range is advisory.

**7. Budget vs. ad set count** — Campaign.
Roughly 50 conversions/week per ad set to exit learning. Two ad sets splitting a small
budget usually leaves both below the threshold. If that's the setup, say so — it's a
real cost, not a nitpick.

---

## Things you need in order to read results

**8. URL parameters** — Ad level → Tracking.
Present, and **identical across ads**. Without it you can't attribute a lead to a
creative. Reading the field's value may be blocked as query-string data; check its
length and a few `.includes()` substrings instead.

**9. Naming distinctness** — campaign, ad set, ad.
`{{campaign.name}}`, `{{adset.name}}` and `{{ad.name}}` must resolve to *different*
strings per variant, or your analytics can't tell the variants apart. Duplicates keep
the original names, so this fails by default after every duplicate. Macros substitute
at publish time — renaming later doesn't fix data already collected.

**10. Advantage+ creative / Essential enhancements** — Ad level.
Identical across ads you're comparing, or the A/B test is really testing enhancements.
**Essential enhancements is collapsed by default** and contains items marked "On by
default" — expand it; the summary lies by omission. Counts can legitimately differ
(`0/4` vs `0/6`) when one creative is a Reel and exposes extra options; what matters
is that everything is off on both.

**11. Creative copy** — Ad level → the live post.
Read the actual caption on the published post, not the editor's preview. Look for
unfilled placeholders, a stale phone number, or a link that no longer resolves. This
is the one check a text dump of settings will never catch.

---

## Before you walk away

**12. Phantom-draft sweep** — campaigns table → **"Review and publish (N)"**.
Opening an editor can create an unpublished draft without you editing anything (the
URL-parameters field re-saves itself). If N > 0 and you made no intentional change,
open it, confirm the changes are the phantom kind ("Updated: Creative", no errors),
**Cancel**, then use the trash icon → **Discard drafts**. Confirm the button goes grey.

Publishing a phantom draft restarts the learning phase for nothing — which makes a
read-only audit the most expensive thing you did that day.

---

## Reporting

Separate the three urgencies explicitly, because they read identically in a list:

- **Blocking** — the ad can't deliver. Rare.
- **Silently expensive** — audience widened, wrong conversion event, learning reset.
  This is where almost everything lands.
- **Suboptimal** — naming, parity, missing attribution. Fix at the next safe window,
  not now, if the ad set is mid-learning.

And say which checks *passed*. "Four of these are correct and this one isn't" is a
usable report; "looks fine" isn't.

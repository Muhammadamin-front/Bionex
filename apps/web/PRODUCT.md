# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Uzbek men and women over 40 (mostly 45–65) troubled by high blood pressure, headaches,
dizziness, tinnitus, numb or swollen limbs. They arrive on a phone, almost always from an
Instagram/Facebook video ad (often inside the app's own browser), having already heard the
product named. Many are not confident with phones or forms. Their job: decide quickly whether
to trust the seller, then leave a name and phone number so an operator rings them.

## Product Purpose
A one-page order site for **Зейнара**, a natural syrup (9 plant extracts, 330 ml, a dietary
supplement / БАД, not a medicine) for heart and blood-vessel health. Success is a real person
leaving a working phone number; operators call within 15 minutes, delivery is free across
Uzbekistan in 1–3 days, payment only on receipt.

## Positioning
Sold by **Оромгоҳ даволаш маскани**, a real health establishment (owner confirmed 2026-10-24),
which is the site's name. The product stays Зейнара. Cash on delivery, no prepayment, discreet
packaging, an operator who calls and explains.

## Operating Context
- Visitors come from short video ads; the first order form must be reachable at once.
- Orders go to operators who ring back; there is no cart, no online payment.
- The same page code also builds a separate partner site (`vite --mode t2`), which keeps its
  own older look; this record is about the main site only.

## Capabilities and Constraints
- Content in Uzbek, **Cyrillic** script; all page copy lives in `src/config/product.ts`.
- Two fields only: name and phone (+998). Browser autofill is deliberately off (customers change
  SIM cards). Hidden decoy fields and bot traps in `OrderForm.tsx` must stay working.
- Strict CSP: no third-party fonts, scripts or images beyond Turnstile and Meta Pixel.
- No price shown (operators tell it). The contact phone is currently switched off.
- Nothing on the main site may name or hint at the company behind the code (the owner's rule):
  visitors must not be able to connect it to other sites.

## Brand Commitments
- Site name: **Оромгоҳ даволаш маскани**. Product name: **Зейнара**.
- Colours: entirely light blue (owner's explicit choice, 2026-10-24).
- Tone: warm, homely, family-centred, respectful of elders (owner chose "xalqona, iliq").

## Evidence on Hand
- Five customer reviews confirmed real by the owner (`product.reviews`).
- Images in `public/images/zeynara/`: the pack (`zeynara*.webp`), its heart cut-out, an elderly
  couple (`family.webp`), a vessel illustration, a doctor photo (`doctor.webp`, unused: no real
  consenting expert), OG image.
- WHO statistics with source; an Ibn Sino quote.
- No expert endorsement, no certificates, no price. Do not invent any.

## Product Principles
1. Trust before persuasion: a calm, honest page converts this audience better than alarm.
2. The form is never more than a thumb away, and never harder than two fields.
3. Every health statement stays within supplement wording; never claim to cure.
4. Large type and clear contrast: readers are older and on small phones.

## Accessibility & Inclusion
Older readers: body text ≥ 18 px, large tap targets, strong contrast, reduced-motion respected,
no meaning carried by colour alone.

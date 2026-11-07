# AGENTS.md — handover for AI agents

Read this first. It records what the codebase is, how it is deployed, and what was decided
in the working sessions so far (last updated 2026-10-21). Details live in `docs/`.

## The user

- The owner of the business. Not a programmer: give **short, step-by-step instructions in
  Uzbek (Latin script)**, one step at a time, with the exact button names. Their Google and
  Meta interfaces are in **Russian**.
- Prefers the agent to choose the technical route ("whatever is convenient for you").
- Runs deploys themselves from the VS Code terminal (an agent's `wrangler deploy` may be
  blocked by the permission classifier). `wrangler secret put` worked from the agent.
- Workflow so far: commit straight to `main` and push to `origin`
  (github.com/Muhammadamin-front/Bionex). Never commit the user's untracked
  `kampaniya-ishga-tushirish-qadamlari.md`, `zeynara-video-script-v*.md`.

## What this is

A landing page for **Zeynara** (a blood-pressure supplement) with an order form. Orders go to
an operators' Telegram group; operators ring the customer and press outcome buttons.

| Part | Where | What |
|---|---|---|
| `apps/web` | Vite + React | the landing page and order form |
| `apps/worker` | Cloudflare Worker `zeynara` + Durable Object `LeadRegistry` (SQLite) | `/api/leads`, Telegram bot + webhook, operators' panel `/panel` (`/crm`), Meta Conversions API, cron |
| `apps/partner` | Cloudflare Pages project `zeynaraa-uz` | the **partner site** (see below) |
| `packages/shared` | | lead schema, phone, UTM sanitizing (shared by web and worker) |

- Main site: https://zeynara.8pj6jsdbgr.workers.dev (Pixel `1109358048693673`)
- Partner site: https://zeynaraa-uz.pages.dev (Pixel `1783794022832394`, an outside targetologist's)

Commands (from repo root):
```
npm run typecheck
npm test --workspace=@bionex/worker      # 86 tests, Miniflare
npm test --workspace=@bionex/shared      # 66 tests
npm run deploy --workspace=@bionex/worker      # main site + worker
npm run deploy:t2 --workspace=@bionex/worker   # partner site (Pages); deploy the worker FIRST
npm run deploy:oromgoh --workspace=@bionex/worker    # the light-blue «Оромгоҳ» design instead (see #28)
```
`apps/web/.env.production` and `apps/web/.env.t2` are gitignored (values are public: Turnstile
site key, site URL, Pixel id, `VITE_META_BROWSER_LEAD=1` for t2). They exist only on the
user's Mac.

## Principles already settled — do not undo without asking

1. **Main site: a clean order is a server `Lead` at once (since 2026-10-29, #32); a suspect one only
   after the main sheet's «Holat»** («Sotildi» / «Kerakli» — see #20). Earlier rule (until 2026-10-29):
   Lead only after an operator confirmed a real person. Since 2026-10-27 (owner: «telegramga
   faqat malumot borsin») Telegram buttons send NOTHING to Meta (they still mark/track; 🚫 still
   withholds the order). 🚫 Спам and unmarked orders are never reported. No browser `Lead` on the main
   site. Reason: 5 of the first 8 leads were fake; see `docs/META-CAPI.md`, `docs/SPAM.md`.
2. **The partner site is the targetologist's alone and must not reveal the main site**: no
   main Pixel, domain or "bionex" string in its build; its orders never reach the operators'
   Telegram group, CRM panel, lists or reports; main-site orders never reach its sheet/dataset.
3. **Partner site Lead is sent at once for every accepted form** (the owner's explicit
   choice, 2026-10-21): browser Pixel `Lead` (eventID = submissionId) + server CAPI `Lead`
   (same event_id) when `META_T2_CAPI_TOKEN` is set. A version that waited for the sheet's
   verdict was reverted. Exception (owner, 2026-10-26): a bot trap (`TRAP_FLAGS` = honeypot +
   bot_trap) sends no Lead on either site — browser (OrderForm checks `caughtByBotTrap` and
   the decoys) or server.
4. Spam is fought by making it worthless, not by blocking customers (mobile NAT shares IPs).

## What was built in these sessions (newest last)

1. **Operators' CRM panel** (`apps/worker/src/panel/panel.html`, `panel.ts`): table of leads
   with campaign / ad set (`utm_term`) / video (`utm_content`), target stats, CSV export,
   sorting, filters, 30 days. «🧹 Панелни тозалаш» moves current orders to «🗄 Архив»
   (`list_items.archived_at`). Personal 7-day browser link via private `/panel` to the bot
   (never posted in the group). Dry-run sign-in bypass only on localhost. CSV formula-safe.
2. **URL parameters for ads** (Meta → Ad → Tracking → URL parameters):
   `utm_source=facebook&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}`
   Conversion location must be **Website**, never Instant Forms (those leads stay inside Meta).
3. **Partner site** (`docs/PARTNER-SITE.md`): Pages serves the same page built with
   `--mode t2`; `apps/partner/functions/api/[[path]].ts` forwards only `POST /api/leads` over a
   service binding to the worker's named entrypoint `PartnerSite` (unreachable from the
   internet). `registry.acceptPartner` keeps only hashes (`partner_leads`, own numbering
   `site_seq_t2` in `meta`), writes the order to the partner's Google Sheet and sends the Lead.
4. **Google Sheet** («Bionex Leads», tab «Lidlar», owned by the user, shared with the
   targetologist): an Apps Script web app (code in `docs/PARTNER-SITE.md`) appends rows **by
   header name** (columns may be reordered, not renamed: №, Sana, Ism, Telefon, Kampaniya,
   Ad set, Video, Belgi, Holat, Izoh, Qurilma) and copies the owner's own «Holat» dropdown to new rows.
   Secrets `SHEETS_T2_URL`, `SHEETS_T2_SECRET` are set. Changing the script needs
   **Manage deployments → ✏️ → New version** (never «New deployment»: the URL would change).
   An edit trigger was tried and abandoned (the user could not get `setup` to run).
5. **Spam marks follow the device**: the browser keeps a random id (`apps/web/src/lib/device.ts`,
   localStorage `bx_device`), sent as `deviceId`; `spam_marks` (replaced `spam_sources`) keeps
   network + device hashes for 30 days. 🚫 in Telegram or «Keraksiz»/«Spam» in the sheet mark
   them; later orders on **both** sites arrive flagged (`spam_device` / `spam_source`).
   The sheet's «Holat» column is read by the cron `*/5 * * * *` (`PARTNER_SHEET_CRON`,
   `readSheetStatuses` → `syncPartnerSpam`). A marked device or a honeypot gets no server Lead.
6. **Look-alike phones** (2026-10-21): the browser also sends `fingerprint`, a SHA-256 of user
   agent, screen, languages, time zone, CPU, graphics and a canvas drawing (`deviceFingerprint`
   in `apps/web/src/lib/device.ts`); stored as `fp_hash` on leads, partner_leads, spam_marks.
   When the device id is new but the likeness matches a spam mark, the order is flagged
   `spam_lookalike` («аввал спам бўлган қурилмага ўхшайди»). **Flag only, never block** —
   the owner's decision; same-model phones can share a likeness.
7. **Phone model shown to people** (2026-10-21): `deviceModel` («SM-A135F · Android 13») from
   `navigator.userAgentData` (Chrome) or the user agent (FB/IG in-app browsers name it; Safari
   never names the iPhone), server falls back to the request's user agent
   (`packages/shared/src/device.ts`). Shown as 📱 in Telegram and in the sheet's «Qurilma»
   column (the owner must add that header; rows go by header name). Not stored, not hashed.
   Shown by name: Android codes via `apps/worker/src/android-models.json` (from Google Play's
   device list, rebuilt by `scripts/android-models.py`), iPhone ids by a table in `models.ts`;
   Safari's plain «iPhone» is narrowed by screen size in the browser (a group of models).
   Seen on 2026-10-21: every partner spam order carried `no_captcha` and a plain Chrome
   «Android 10; K» user agent with rotating versions (141/144/147/152); every real one came
   from the Instagram in-app browser.
8. **`likely_bot` flag**: `webdriver`, or `no_captcha` and not opened in Instagram/Facebook (`fromSocialApp`).
   Flag only. The owner chose NOT to withhold the partner's server Lead for it (yet).
9. **«Tafsilot»** (sheet column / 🔬 in Telegram): `signals` from the browser (GPU, touch
   points, webdriver, fill time, keys typed/pasted, time zone, language, ad click via
   fbclid/_fbc, Chrome's real version vs the user agent's), `describeSignals` in shared. The
   owner suspects a computer posing as a phone behind mobile proxies; this is how to tell.
10. **Panel shows «Qurilma» and «Tafsilot» too** (2026-10-22): `list_items` gained `device`
    and `details` columns, stored on `accept` (main site); `panelData` returns them and the
    operators' Mini App (`panel.html`) renders them as two columns (details wrap, suspect ones
    amber) and in the CSV. Makes the Telegram panel match the partner Google Sheet's layout.
11. **Bot orders kept out of the partner sheet** (2026-10-22, owner's request): in
    `acceptPartner`, an order flagged `honeypot`, `likely_bot`, `spam_device` or
    `spam_lookalike` is accepted and counted but NOT written to the Google Sheet, so the
    partner's people don't call bots. Bare `no_captcha` still goes (a real in-app-browser
    customer can fail Turnstile). The Meta Lead gate (principle #3) was NOT changed.
12. **Panel installable as a desktop app (PWA)** (2026-10-23, owner's request, for a computer):
    `apps/worker/src/panel/pwa.ts` serves a manifest, two PNG icons and a tiny service worker
    (caches nothing — a fetch handler only, Chrome's install condition) at
    `/panel/manifest.webmanifest`, `/panel/sw.js` (header `Service-Worker-Allowed: /panel`) and
    `/panel/icon-{192,512}.png` (routed in index.ts, public, no lead data). panel.html links the
    manifest + theme-color and registers the SW; panel.ts CSP gained `manifest-src`/`worker-src`.
    Chrome/Edge then show «Install» in the address bar. start_url `/panel`; the personal key
    still lives in localStorage, so a 7-day-expired install shows the «open from the bot» message.
13. **Main-site bot/spam orders hidden from the panel & lists** (2026-10-23, owner's request):
    `LIKELY_BOT_FLAGS` (honeypot, likely_bot, spam_device, spam_lookalike) — shared by `accept`
    and `acceptPartner`. On the main site such an order still reaches the operators' GROUP (with
    its buttons) but `list_items.hidden = 1`, so it is left out of `panelData`, `/royxat` lists
    and the archive; stats (lead_status) still count it. A bare `no_captcha` stays visible.
14. **More bot traps** (2026-10-24, owner's request «honeypot tuzog'ini qo'shgin»): the old
    hidden «fax» field caught none of the partner spam, so the form gained a second decoy
    (`name="website"`, sent in the same `contactFax` field) and the browser now counts real
    touches (`taps`), made-up clicks (`synthetic`) and time on the page (`pageMs`) in `signals`.
    `caughtByBotTrap` (shared) → flag `bot_trap` («бот тузоғига тушди»), in `LIKELY_BOT_FLAGS`
    (hidden from panel / partner sheet, kept in the group). Like `likely_bot` it does NOT
    withhold the partner's server Lead. Flag only.
15. **`likely_bot` is a warning again, not hidden** (2026-10-24, owner's decision): the owner
    found real customers among failed-check orders (the Telegram profile of the number bore the
    same name). `likely_bot` (no_captcha outside Instagram/Facebook) left `LIKELY_BOT_FLAGS`:
    such orders show in the panel, lists and partner sheet with «бот эҳтимоли бор (одам ҳам
    бўлиши мумкин)». `webdriver` moved from `likely_bot` to `bot_trap` (still hidden). The
    owner declined a Telegram-contact confirmation button for now (offered: bots cannot do it;
    looking up a number's Telegram name automatically is not possible with the Bot API).

16. **Main site redesigned as «Оромгоҳ даволаш маскани»** (2026-10-24, owner's request): the
    owner renamed the main site (a real establishment of theirs; the product stays Зейнара) and
    asked for an entirely light-blue, homely look, phone first. Direction picked on the
    impeccable decision page: the paxta-guli (cotton-boll) tea set on a dasturkhon. The two sites
    are now separate trees chosen at build time by the Vite alias `#site`
    (`src/sites/main/` for the main site, `src/sites/partner.tsx` = the old page, untouched);
    the partner build contains none of the new page, its name or its font. `mainSiteHead` in
    vite.config.ts adds the name and a piyola favicon to the main site's `<title>`. Shared
    OrderForm/OrderModal take the colours through re-pointed tokens in
    `src/sites/main/oromgoh.css`; AntiMetalButton gained `--btn-*` vars (defaults = old green).
    Product truth for design work: `apps/web/PRODUCT.md`; direction contract:
    `apps/web/.impeccable/surfaces/`. The owner also wants visitors never to learn of the
    company behind the code (the repo is public; they chose to keep it public).

17. **Google Sheets hide only the honeypot** (2026-10-25, owner's decision): the owner opened
    their own Instagram ad, failed the «verify human» check and concluded real customers were
    being lost. Both sheets (partner `acceptPartner`, main-site copy in `accept`) now skip only
    `SHEET_HIDDEN_FLAGS` = `honeypot` + `bot_trap` (2026-10-26: to the owner «honeypot» means
    both traps; they complained bot_trap rows still reached the partner sheet). `spam_device`,
    `spam_lookalike`, `likely_bot` and `no_captcha` go in with their warnings, and a failed
    check starts «Belgi» with «! ». A hidden partner order is seen by nobody (no Telegram). The
    panel/lists still hide `LIKELY_BOT_FLAGS`; the partner's Meta Lead rule is unchanged.

18. **No Pixel automatic events on the main site; honeypot never reported** (2026-10-25): Events
    Manager showed parameter-less browser `Lead`s on the main Pixel beside the CAPI ones —
    most likely the Pixel's own automatic form detection (not our code; the bundle has no
    `Lead` call on the main site). `pixel.ts` now sets `fbq('set','autoConfig',false,id)` before
    `init` when `VITE_META_BROWSER_LEAD` is not 1 (partner Pixel unchanged). `accept` stores no
    `meta_pending` row for a `honeypot` order, so no outcome button can report it. To confirm:
    after deploy, browser Leads in Events Manager should stop within 1–2 days.

19. **`deploy:old-design`** (2026-10-26, owner's request): the owner wants the Worker changes
    (sheets, Meta) live while the new «Оромгоҳ» design waits. `MAIN_DESIGN=old` makes
    vite.config.ts point `#site` at `src/sites/partner.tsx` (the original page) for the main
    build and skip `mainSiteHead`; shared form fixes and the Pixel autoConfig fix still ship.
    Plain `deploy` publishes the new design. The owner then said the new design must stay live
    (deploying old-design was a misunderstanding): give only plain `deploy` from now on.

20. **Main sheet «Holat» drives Meta too** (2026-10-26, owner's request «signalni Google
    Sheets'dan olishimiz kerak»): the 5-minute cron also reads the main sheet («Bionex-Zeynara»,
    tab «Lidlar», № = the Telegram order number) via the same Apps Script `statuses` action.
    `sheetOutcome`: «Sotildi» → sold (Lead + Purchase), «Kerakli» → `rejected` (Lead only),
    «Keraksiz»/«Spam» → spam (no Lead, device/network remembered as `sheet:<id>`), anything
    else waits. Telegram buttons still report too (owner chose both); whichever is marked first
    sends the one Lead (`meta_pending` row is consumed). Only works if the main sheet's script
    is the same as the partner's (has `statuses`).

21. **Bot traps never reach Meta** (2026-10-26, owner's request): `TRAP_FLAGS` (renamed from
    SHEET_HIDDEN_FLAGS) also gates the partner's server Lead and the main site's
    `meta_pending` row; OrderForm skips the browser `trackLead` when a decoy is filled or
    `caughtByBotTrap(signals)`. Needs both deploys (worker, then t2) to take full effect.

22. **Telegram is information only for Meta** (2026-10-27, owner's request; they moved fully to
    Google Sheets): `button()` in registry.ts no longer calls `reportToMeta`; only `syncMainSheet`
    does. A Telegram 🚫 deletes the order's `meta_pending` row. Orders kept out of the sheet
    (`LIKELY_BOT_FLAGS`) can therefore never reach Meta. If the sheet script or its secrets break,
    no main-site Lead is sent at all — watch Cloudflare Logs for «Google Sheets».

23. **Partner sheet also drops `likely_bot`** (2026-10-27, owner's choice after seeing failed-check
    rows in the partner's sheet; an earlier edit of the MAIN sheet was a misreading and reverted):
    `PARTNER_SHEET_HIDDEN_FLAGS` = `TRAP_FLAGS` + `likely_bot` (failed check outside the
    Instagram/Facebook app). A failed check inside the app (`no_captcha` only) still goes in with
    «!». Sheet only: the partner's Meta Lead rule and the main site are unchanged. The owner had
    said not to touch the partner site, then asked for exactly this on its sheet.

24. **`reused_click` warning** (2026-10-27, owner's request: a real person copies the ad link and
    spams): the browser sends `clickId` (Meta's `fbclid` from the address or the `_fbc` cookie,
    `adClickId` in device.ts); the worker keeps only its hash (`leads.click_hash`, 30 days) and
    flags an order whose click id is behind an earlier order from another number: «шу реклама
    босилиши аввал бошқа рақамдан ишлатилган» / «shu reklama bosilishi…». **Warning only** — a customer
    forwarding the link looks the same; not hidden, not withheld from Meta. Main site only
    (acceptPartner ignores `clickId`). The owner was told NOT to change the ad link in Meta (editing an ad
    can reset learning, and a copied link repeats anyway). «reklama bosilmagan» in «Tafsilot» already
    shows orders without an ad click.

25. **Autofill may fill a decoy; main site tells it from a bot** (2026-10-28, owner's worry that a
    real customer is hidden as «honeypot»): the decoys are off-screen, not `display:none`, so
    autofill / password managers can fill them. (a) The two decoy inputs carry `NO_AUTOFILL`
    (`data-lpignore`, `data-1p-ignore`, `data-bwignore`, `data-form-type`). (b) `takeOrder`, **main
    site only**: a filled decoy from a browser that sent `signals` with no program sign
    (`!caughtByBotTrap`) becomes `decoy_filled` — a warning like `likely_bot`: it goes to the main
    sheet, the panel and `meta_pending` (so «Sotildi» can report it). No signals (a direct API post)
    or any program sign (webdriver, made-up click, untouched touch screen) stays `honeypot` / `bot_trap`
    and is hidden as before. The partner site is unchanged: any filled decoy is a trap there. A bot
    that fakes human `signals` and fills a decoy now reaches the sheet (the repo is public).

26. **Main site: suspect orders go to a «Spam» tab** (2026-10-28, owner's request «tekshiruvdan o'ta
    olmagan spam, bot barchasini alohida sheetsga», chosen: failed check included, as a new tab of
    the same spreadsheet): `MAIN_SPAM_SHEET_FLAGS` = `TRAP_FLAGS` + `no_captcha` + `likely_bot` +
    `spam_device`. Such an order is written to tab «Spam» (the Apps Script makes it on first use),
    every other to «Lidlar» — never both; Telegram/panel are unchanged. «Holat» is read from «Lidlar»
    only, so nothing in «Spam» reaches Meta unless a person copies the row (with its №) into «Lidlar»
    and sets «Sotildi»/«Kerakli» (the `meta_pending` row exists for non-trap orders). `spam_exported`
    remembers what is already in the tab. **`/spam N`** in the operators' group (default 3 days, max 30)
    copies earlier suspect orders back from `list_items.msg_html` (flags read with `flagsInMessage`),
    12 per run and the rest on every 5-minute cron tick (`continueSpamExport`), then says so in the
    group; re-running is harmless. Orders that already sit in «Lidlar» are not removed (delete by hand).
    The partner sheet is separate and unchanged (#23).
    2026-10-28: the first `/spam 3` rows landed in «Lidlar», not «Spam»: the main spreadsheet's Apps
    Script is NOT the one in docs/PARTNER-SITE.md (it ignored `data.sheet`, skips «Belgi» in «Lidlar», and
    also sends its own QualifiedLead to the main Pixel when «Holat» = «Kerakli»). Its full current
    text, with the «Spam» routing, is `docs/main-sheet-script.js`. Fix is in the script, not the Worker. `/spam N qayta` forgets `spam_exported` for those days
    and writes them again (after the wrong rows are deleted by hand).

27. **The main Pixel's stray browser `Lead` was a Meta-side rule, not our code** (2026-10-28):
    Events Manager → dataset → Settings → Automatic events → Manage events had a rule «Added by
    Automatic events» (made 2026-10-23 16:30, `estRules` in the Pixel's config, rule_id
    1006464389144185): a click on a button whose text contains «батафсил маълумот олиш» (our submit
    button) → `Lead` (`es=automatic`, `cd[cs_est]=true`, `est_source`). It sent a Lead for every
    click, bots included, beside the sheet-confirmed CAPI Lead; `autoConfig=false` does not stop it.
    The owner deleted it; the config at connect.facebook.net/signals/config/1109358048693673 no
    longer has `estRules`, and a test submit (Meta requests intercepted, never sent) shows only
    PageView + InitiateCheckout. Check that config first if browser Leads ever come back.

28. **Main site back to the original page, with real proof** (2026-10-28, owner's request: many
    landing page views, few leads): the main build's `#site` is now `src/sites/classic/index.tsx` —
    the original page (`components/landing/Landing.tsx`; its arrival popup off here — `popup={false}`,
    the same day, as it covered the videos; the partner keeps it) plus a
    `proof` section between the hero and the first form (moved above it the same day; back under it on 10-29, #34): six real customers' videos — three filmed stories with the
    box in hand (`story-1..3`, 9:16 at 540×960, 2–8.5 MB) and three Telegram video messages
    (`review-1..3`, cropped square, ~2.5 MB), one swipeable row on phones, `preload="none"` + poster. Videos are built into
    `/video/` and served by the Worker with byte ranges (`src/video.ts`, `run_worker_first`): static assets
    answer Range with 200, and iPhone Safari / the Instagram app on iOS then plays nothing. `VideoRow` autoplays
    (owner's request): muted once the row is ≥50% on screen, next one on `ended` (stops after the last),
    pauses off screen; with sound when `navigator.userActivation.hasBeenActive` (any earlier tap,
    e.g. closing the order dialog), else muted with a big «🔊 Овозни ёқиш учун босинг» (sound then
    stays on for the rest); browsers forbid sound before a tap — Playwright pages always count as tapped; no autoplay on data saver or
    prefers-reduced-motion. Swiping the phone row to another video plays it and pauses the
    previous (an IntersectionObserver on the row, ≥60% visible) and the Ministry of Health
    sanitary-epidemiological certificate № 482583 for «Зейнара» (valid to 29.07.2028; it states
    safety, not efficacy — keep the wording to that). The media sit in
    `src/sites/classic/media/` (gitignored: only on the deploying Mac; a missing file hides its
    part). `Landing` gained an optional `proof` prop; the partner build passes none and contains no
    media. The «Оромгоҳ» design stays in the tree: `MAIN_DESIGN=oromgoh` / `npm run deploy:oromgoh`
    (only then is `mainSiteHead` applied). #19's `deploy:old-design` is gone; #16's design is no
    longer the default.

29. **A made-up click alone no longer traps a main-site order** (2026-10-28): two orders the owner
    confirmed as real customers carried only «dastur bosgan ×2» (sensor 5, a few letters typed, Uzbek
    clock, 35–94 s on the page); earlier №117/№119/an iPhone 12 looked the same with ×3. Some in-app
    browsers seem to make untrusted clicks. Main site: `bot_trap` = `programDriven` (webdriver, or a
    touch screen nobody touched); `synthetic` alone → `synthetic_click`, a warning: «Lidlar», panel,
    `meta_pending`. `decoy_filled` also uses `programDriven`. Partner site unchanged (`caughtByBotTrap`).
    Orders trapped this way before the deploy sit in the «Spam» tab with «dastur bosgan ×N» and no
    «webdriver» / «ekranga tegilmagan»: worth a call.

30. **The bottom order bar covered the form's submit button** (2026-10-28): with the button near the
    bottom of the screen, a tap landed on the always-on «Бепул консультация» bar (it slides back in
    when the keyboard closes) and only scrolled to the form — the order was never sent. `Landing`
    `barOverForms` (default false since 2026-10-29, both sites — the owner allowed the partner fix) hides
    the bar while either form is on screen. Same day the owner saw no
    orders after 15:57 — no deploy happened then (09:38, 16:21 were the deploys); a live test order
    at ~18:20 returned 201 and logged no Telegram/Sheets error. Worker/DO invocations did fall after
    16:00, so look at the ads (edits put an ad back into review) before the code.

31. **No «not a robot» check on the main site** — *narrowed to the Instagram / Facebook in-app
    browser only on 2026-10-31; read #46 first* (2026-10-29, owner: their own phone, from the ad in
    Instagram, could not pass «Verify you are human»; on submit the form also waited up to 14 s
    «Текширилмоқда…»). Vite defined `VITE_HUMAN_CHECK` = '0' except for `--mode t2`; `OrderForm`
    then never loads Turnstile and sends at once. Worker, main site: no token is normal (no
    `no_captcha` / `likely_bot`); no token AND no browser `signals` (a direct API post) → `no_browser`,
    in `TRAP_FLAGS` and `LIKELY_BOT_FLAGS` (Spam tab, hidden from panel, never Meta). A token that
    is sent is still verified (old cached pages). The partner site keeps Turnstile unchanged. The
    honeypot and `bot_trap` (webdriver / untouched touch screen) stay on the main site. Turnstile
    widget «Zeynara» (managed, both hostnames) untouched in Cloudflare.

32. **Main site: clean orders are a Lead at once** (2026-10-29, owner's choice). After the stray
    Events Manager rule went (#27) the main Pixel got almost no Leads (only sheet-confirmed ones) and
    the ads' signal collapsed — the targetologist read it as «the site stopped sending Lead». Now
    `accept` sends the CAPI `Lead` (event_id = submissionId) on arrival unless the order has a
    `NO_INSTANT_LEAD_FLAGS` flag (`MAIN_SPAM_SHEET_FLAGS` + `spam_lookalike` + `reused_click`);
    `meta_pending.lead_sent = 1` then keeps «Sotildi»/«Kerakli» from sending a second Lead («Sotildi»
    still adds Purchase when `META_ORDER_VALUE` is set). Suspect non-trap orders wait for the sheet as
    before. Still no browser `Lead` on the main site. A later «Keraksiz» cannot take a sent Lead back.

33. **The order button rises above the keyboard** (2026-10-29, owner: older customers do not know how
    to close a phone keyboard): when the phone field reaches 9 digits, `OrderForm.showSubmitButton`
    scrolls just enough (by `visualViewport`) for the submit button to sit above the keyboard. The
    keyboard's own «send» key already submits (`enterKeyHint="send"`). Shared `OrderForm`: reaches the
    partner site only with `deploy:t2`.

34. **Main site: the first form is above the videos again, and the arrival dialog is back** (2026-10-29,
    owner: «lead ham spam ham kelmay qo'ydi»). Checked end to end: the ads kept delivering (~78 link clicks
    after 16:00 on 10-28, ~48 by 09:00 on 10-29), the Worker had no errors, the main sheet's Apps Script ran
    every 5 minutes without failure, and the partner page (same OrderForm and Worker, form under the hero,
    arrival dialog on) kept getting orders through the night. The main site went from an order every ~20
    minutes to 3 in 16 hours right after the 16:21 deploy of 10-28; the Pixel's InitiateCheckout (form
    focus) fell with it. Cause: the `proof` section above the first form put the form ~3000 px (four phone
    screens) down, and `popup={false}` removed the dialog. `Landing` now renders `proof` right under
    `QuickOrder`, and the main site uses the default `popup`. Ask the owner before moving the form below
    anything again. (The dialog went off again on 2026-11-04, the owner's explicit choice: see #53.) Also seen in Ads Manager that day: a campaign «Instant form test» (Instant Form leads
    stay in Meta, never reach the sheet/Telegram) and two ads with unpublished edits — the owner was told.

35. **Limits count the phone, not the network** (2026-10-29, owner's choice after the targetologist
    pointed out CGNAT: Beeline/Ucell/Mobiuz put hundreds of customers behind one IP, and the
    network limits — 3 attempts/hour, 3 numbers/day — could refuse real buyers unseen). `check` now
    takes `device` (the browser's `deviceId`): the 3-per-hour limit (`IP_ORDERS_PER_HOUR`, name kept)
    is per device, the network only capped at `NETWORK_ATTEMPTS_PER_HOUR` = 30; `numbersToday`
    makes `LEADS_PER_IP_PER_DAY` (name kept) per device, network cap `NETWORK_PHONES_PER_DAY` = 30, and
    from 3 numbers a day a network's orders carry `multi_phone_ip` (warning). No device id → the old
    per-network limits. Every refusal goes to table `refusals` (7 days) and the daily /hisobot shows
    «🚧 Лимит сабабли қабул қилинмади: N та (…)» for the main site. Both sites (shared Worker).
    Before this, refusals were logged nowhere, so how many customers the old limits lost is unknown.
    **The main site's part was undone on 2026-11-04: see #54.** The partner site still works this way.

36. **Silent failures now reach the operators' group** (2026-10-29, own audit): a main-site order the
    sheet refuses (`SHEET_WRITE_ALERT`), an unreadable «Holat» on the 5-minute read
    (`SHEET_READ_ALERT`, index.ts `syncMainSheet`), and a Lead the main dataset refuses or never gets
    (`META_ALERT`; `sendMetaEvent` now returns a boolean, `watchMeta`) each post one ⚠️ message to the
    reports thread, at most hourly per kind (`alert`). The partner's sheet/dataset raise nothing in
    the group (#2). Also: `buildUserData` makes `fbc` = `fb.1.<now>.<clickId>` when the `_fbc` cookie
    is not set yet (the Pixel loads only once the page is idle), so an early order still carries its
    ad click to Meta.
    2026-11-02: an unreadable «Holat» alerts (group or owner) only from the **second failed read in a row**
    (`sheetReadFailures`, `meta.read_failures_<kind>`, reset by a good read): an Apps Script misses a single
    read now and then, and nothing is lost since every read takes the whole column.

37. **The owner's private alerts** (2026-10-29): the partner's sheet is the only place its orders go,
    so a refused write (`acceptPartner` → `ownerAlert('partner-sheet-write')`) or an unreadable
    «Holat» (`syncPartnerSheet` → `ownerAlert('partner-sheet-read')`) goes to ONE private chat, never
    the group. That chat is set by sending **/ogohlantirish** to the bot privately (group members
    only; `setOwnerChat`, `meta.owner_chat`; the last one to send it wins). Unset → only logged.
    The main sheet's Apps Script still sends its own `QualifiedLead` on «Kerakli» (docs/main-sheet-script.js):
    a different event from the site's `Lead`, left as it is (the owner was told).

38. **Own domain `zeynara.com.uz`** (2026-10-30, bought by the owner at ahost.uz). Not yet on
    Cloudflare when this was written (no NS records; the wrangler OAuth token has `zone (read)` only,
    so the owner adds the zone in the dashboard and points the domain's NS at Cloudflare at ahost).
    Prepared and inert until then: `SITE_HOST` (index.ts) — when set, `/` on *.workers.dev and on
    `www.` answers 301 to `https://SITE_HOST/` with the query (fbclid, utm) kept, so ads on the old
    link keep working; the API, panel, video and webhook answer on every host. `run_worker_first`
    gained `/` for that. Still to do once the zone is active: `routes` custom domains (apex + www) and
    `"SITE_HOST": "zeynara.com.uz"` in wrangler.jsonc vars, `VITE_SITE_URL` in apps/web/.env.production,
    Meta domain verification (Business Settings → Brand safety → Domains, DNS TXT), new ads on the domain.

39. **The main page is prerendered** (2026-10-30, ported from the Mega-Akula project, which was forked
    from this code): `npm run build` (main only — `build:t2` unchanged) renders the page into
    dist/index.html (`src/entry-server.tsx`, `scripts/prerender.mjs`: HTML filled in, CSS inlined)
    and `main.tsx` takes it over with `hydrateRoot`; the `landing` class is in index.html. Code that
    runs during render must not touch `window`/`document` (`captureUtm` returns {} then). The order
    form is read-only, its button a plain one, until hydrated (`ready`). Measured on the built page,
    slow 4G + 4× CPU: first paint/LCP 1.56 s (live, unprerendered) → 0.49 s; no hydration errors; an
    order goes through after hydration. NOT deployed when written: the owner said not to touch the
    Worker while active ad sets point at it.

40. **zeynara.com.uz is a separate Pages site; the Worker's address is left alone** (2026-10-30,
    owner: active ad sets point at zeynara.8pj6jsdbgr.workers.dev, do not touch the Worker). Zone
    `zeynara.com.uz` active since 2026-10-30 03:35Z. `apps/site` = Cloudflare Pages project
    `zeynara-com-uz` serving apps/web `build:site` (prerendered, `dist-site`, `VITE_SITE_URL`
    https://zeynara.com.uz). `functions/api/[[path]].ts` forwards only POST /api/leads over the
    `MAIN` service binding to the Worker's normal entrypoint, rewritten as a post to `MAIN_ORIGIN`
    (the workers.dev address) after its own Origin check — because the Worker re-points the
    Telegram webhook (`drop_pending_updates`!) at whatever origin an order arrives on, and two
    alternating origins would drop operators' button presses. `functions/video/[[path]].ts` serves
    the videos with byte ranges from the site's own files (worker `serveVideo`). Panel, webhook and
    health stay on the Worker. Deploy: `npm run deploy:site --workspace=@bionex/worker` (Worker not
    redeployed). The `SITE_HOST` redirect (#38) stays unset: the old address must keep its page.

41. **The ad's discount is on the page** (2026-10-30): the new ad video (Gulchehra opa, now `story-0`,
    first in the video row) ends with «−25% chegirma, nafaqaxo'rlarga −35%» — the page offered only a
    «free consultation». The owner confirmed the offer runs until 8 November. `lib/offer.tsx`:
    `OfferContext` (provided only by sites/classic, `OFFER`), `useOffer` (gone after `until`, checked
    after hydration), `OfferBanner` (red ticket) in the hero and on every order form; form heading
    «Оператор чегирмали нархни айтади», submit and bottom-bar text «−25% чегирма билан буюртма».
    No price is shown (the operator tells it). Partner page untouched (no provider). After 8 Nov
    remove or change `OFFER`.

42. **QualifiedLead from the Worker, with full match data** (2026-10-30, owner: optimise the ads on
    «Kerakli» — the operators sell well; «Sotildi» alone would be too few). On «Kerakli» or «Sotildi» in
    the main sheet, `reportToMeta` also sends `QualifiedLead` (event_time = now) with the order's stored
    user_data (ph, fn, ln, IP, user agent, fbp, fbc) under the sheet script's own event_id
    `zeynara_<phone digits>_QualifiedLead`, so Meta keeps one of the two (the script's version had match
    quality 3.4/10). Never for a trap order (no meta_pending row) or «Keraksiz». Plan: once ~50
    QualifiedLead a week, a NEW ad set optimised on a custom conversion built from QualifiedLead.
    Also checked that day: the main Pixel config has no estRules (no browser Lead); the
    targetologist's «browser Leads ≫ server, dedup warning» is the 23–28 Oct rule (#27) still in
    Events Manager's window. `META_ORDER_VALUE` unset → no Purchase on «Sotildi» (owner asked if a
    price is required: yes for Purchase; not chosen). 2026-11-06: set, the owner's average takings per
    sale: `META_ORDER_VALUE` = 12, `META_CURRENCY` = USD (the ad account spends in dollars). «Sotildi»
    now adds a Purchase of $12 (main site only; nothing optimises on it yet; a refused Purchase raises
    no group alert, so look in Events Manager after the first one).
    2026-10-31: Events Manager showed ~22 QualifiedLead for 30–31 Oct against 13 marked rows — the
    sheet script (11 «Kerakli») and the Worker (13) both sent each one, the same event_id, counted twice
    and matched at 6.2/10. The owner emptied the script's `EVENT_MAP`; only the Worker sends it now.

43. **Autofilled phone numbers** (2026-10-30, owner: Instagram's in-app browser puts in the Meta
    account's phone — sometimes 10 years old — and orders arrive with dead numbers). The owner's idea
    (a div/span instead of an input) was declined: contenteditable is unreliable on Android / in-app
    browsers and the keyboard still offers the old number. Instead, in `OrderForm`: the phone input is
    `type="text"` (keypad still `inputMode="tel"`) so fewer autofills see a phone field; 5+ digits
    arriving in one change that is not typing/paste set `phoneAutofilled` — a yellow field and «Рақам
    автоматик ёзилди. Шу рақам ҳозир ишлайдими? Текшириб, керак бўлса тузатинг.»; any typing clears it.
    It travels as `signals.autofill` → Worker flag `phone_autofill` (warning, Telegram and sheet;
    still a clean order and an instant Lead), «Tafsilot» «рақам автоматик ёзилган». Shared form: the
    partner site gets it only with `deploy:t2`; workers.dev with the Worker deploy.

44. **«Сизни нима безовта қилади?» on the thank-you screen** (2026-10-30, owner's choice: asked after
    the order, so it costs none; a dropdown in the form would neither stop bots nor be free). Main site
    only (`AskConcernContext`, provided by sites/classic). `ConcernQuestion` (lib/concern.tsx): six
    toggles from `@bionex/shared/concerns` `CONCERNS`, «Операторга юбориш» → POST
    `/api/leads/concern` {submissionId, concerns} (also forwarded by apps/site). Worker `takeConcern` →
    `addConcern`: `submissions.lead_id` (new column) finds the order; once per order
    (`list_items.concern`); reply under the order in Telegram «📝 Мижоз ўзи белгилади: …»; and, only
    when the secret `SHEETS_NOTES=1`, the sheet script's new `note` action writes «Shikoyat» on the
    order's row (Lidlar or Spam; header made if missing; retried once if the row is not there yet).
    The script without `note` would append an empty row — so update the Apps Script (new version)
    BEFORE setting SHEETS_NOTES. The arrival dialog no longer closes itself after an order when the
    question is asked. Live 2026-10-30 on both addresses; the owner updated the Apps Script and
    `SHEETS_NOTES=1` was set the same day.

45. **external_id on every main-site CAPI event** (2026-10-31, after the targetologist read Events
    Manager: Lead match quality 3.4 → 7.8 with our server data; Meta suggested external_id). `buildUserData`
    adds `external_id` = SHA-256 of `device:<deviceId>` (else the phone digits), so the arrival Lead and the
    later QualifiedLead carry the same person id. Declined the same day: their snippet re-running
    `fbq('init')` and firing a browser `fbq('track','Lead')` with a fresh UUID at submit (it would send a
    Lead for every submission, spam included, before the server's verdict, and its id would not match
    the server's); an e-mail field. Safe if the owner wants it: Events Manager «Automatic advanced
    matching» — but never «Track events automatically without code» (#27). The «Improve deduplication»
    warning is the 23–28 Oct browser Leads still in Meta's window.
    Same day: `npm test` failed with «pico is not a function» — iCloud (Desktop & Documents sync,
    upload error CKErrorDomain 25 ≈ quota) had evicted ~4 200 node_modules files, 33 source files
    (incl. the gitignored `.env.production` / `.env.t2`) and ~1 000 .git objects to «dataless». Fixed with
    `find . -flags +dataless -print0 | xargs -0 brctl download`; the owner was advised to move
    ~/Desktop/Projects out of iCloud. If tools fail oddly, check `find . -flags +dataless` first.

46. **The main site asks for the check again — everywhere but the Instagram / Facebook app**
    (2026-10-31, owner: «25–28 sana orasida lidlar juda sifatli edi, 29-dan spam ko'payib ketdi»).
    #31 turned the check off for everyone, which also made `no_captcha` / `likely_bot` unreachable
    on the main site (`noCheckAsked` short-circuits them), so two of the five `MAIN_SPAM_SHEET_FLAGS`
    went dead: the «Spam» tab's last row is **№206, 29.10 11:51** and nothing has been diverted
    since, while the junk share inside «Lidlar» went 11% (№ ≤ 206) → 38% (№ > 206). With #32 sending
    an instant CAPI `Lead` for every «clean» order, that junk was also being taught to Meta. The ads
    open in the in-app browser, where the check is what cost orders on 29.10; the spam arrives from
    plain browsers (`device.ts`: on 2026-10-21 every fake partner order was a plain Chrome that
    failed the check). So `VITE_HUMAN_CHECK` = `'web'` on the main build, `'1'` for `--mode t2`, and
    `OrderForm`'s `humanCheck()` loads Turnstile unless `fromSocialApp(navigator.userAgent)`. Worker:
    `noCheckAsked` now also requires `fromSocialApp(user-agent)`, so a plain browser that sent no
    token has failed the check (`no_captcha` + `likely_bot` → Spam tab, no instant Lead); `no_browser`
    no longer depends on it (main + no token + no `signals` = a direct API post, whatever the UA;
    since 2026-11-04 any token Cloudflare did not accept counts as no token here, so a made-up one hides nothing).
    Comparison that showed it: the partner's «Bionex Leads» (check on, `PARTNER_SHEET_HIDDEN_FLAGS`)
    ran ~23% bad on $100–150/day against our ~38% on $45/day.
    Same day, same owner message: the challenge spoke **English** («Verify you are a human») to
    customers aged 40–60. `turnstileLanguage()` followed `navigator.language` and asked Cloudflare
    for `auto` on any phone set to English — which says nothing about what its owner reads. It is
    `TURNSTILE_LANGUAGE = 'ru'` always now (Cloudflare has no Uzbek), and an Uzbek line
    («…қуйидаги катакчани белгиланг») is shown above the widget exactly while it is asking,
    via Turnstile's `before-interactive-callback` / `after-interactive-callback`.
    Same day, found before deploying: zeynara.com.uz (apps/site) forwards each order as a post to the
    Worker's workers.dev address, so a token solved on the domain failed Turnstile's hostname check
    (`hostname-mismatch`, a config error: «Spam» tab + an hourly group alert) — unseen while the page
    sent no tokens. `verifyTurnstile` now takes `hostnames`; the main site also accepts
    `MAIN_SITE_HOSTS` (wrangler.jsonc var, «zeynara.com.uz»). Do NOT use `SITE_HOST` for this (#40:
    it turns on the redirect). The «Zeynara» widget's Hostnames list in Cloudflare must also contain
    zeynara.com.uz, or the widget errors in the browser, sends no token, and every plain-browser
    order there lands in «Spam». Order: hostname in Cloudflare → `deploy` (Worker) → `deploy:site`.
    Live on both addresses 2026-10-31 ~11:25Z; the widget 0x4AAAAAAFWlm3… now lists all three hosts.
    A second «Zeynara» widget (0x4AAAAAAFt40r…, zeynara.com.uz only) was made by mistake and is unused.
    `spam_lookalike` joined `MAIN_SPAM_SHEET_FLAGS` (it was already hidden from the panel and kept from
    the instant Lead, yet written to «Lidlar»). Not yet like the partner: the in-app exemption trusts the user agent («Instagram», «FBAN»), which
    a script can fake. If «Lidlar» stays junky with in-app user agents, the next step is asking
    everyone (the partner's rule) — the owner's call (#31).

47. **The main site's first screen continues the ad** (2026-10-31, owner approved the mock). Numbers that
    led here: Events Manager 15–30 Oct PageView 1.5K → InitiateCheckout 383 (25 % touch the form); the
    ad set «V1 | UZ 30-65» 285 link clicks → 203 landing views → 27 Leads (13 % of views): the page
    converts; the old first screen showed only the box and badges (headline on screen 2), then the
    arrival dialog. `sites/classic/AdHero.tsx` (main only, via `Landing`'s new `hero` prop; partner keeps
    `Hero`): the ad's words «Юрак ва қон томирлар учун табиий ўсимлик сиропи», Gulchehra opa's face
    (`media/story-0-face.jpg`, cropped from story-0 at 12 s; gitignored like all media — a missing file
    falls back to the old hero) and her words from the ad; ▶ opens her video in place, with sound.
    A compact red ticket, «Ҳозироқ буюртма беринг» (the ad's button), three promises. The phones' order
    bar steps aside while that button is in view (`[data-order-button]`, Landing.tsx). The arrival
    dialog is unchanged: the owner was asked (now / after 20 s) and did not choose — ask before changing it. (They chose on 2026-11-04: no dialog on arrival, #53.)

48. **A sticker by the name for a discount order** (2026-10-31, owner's request): pressing the discount
    (the first screen's red ticket or its button, or the bottom bar while it shows the offer) calls
    `tapOffer` (lib/offer.tsx, kept in sessionStorage); the next order sends `offerTap` = the percent
    (shared lead schema). The Worker, main site only, makes the name «Исм 🎁−25%» for Telegram, the
    panel, the lists and the sheet; Meta gets the name as typed. The forms' own submit («−25% чегирма
    билан буюртма») does not count, or every order would carry it. Deploy the Worker before (or with) any
    page that sends `offerTap`: the schema is strict, an old Worker would refuse such an order.

49. **A main-site order sent within seconds waits for the sheet** (2026-11-01, the targetologist's
    step 4, owner said «bajar»). Their reading of the main sheet 30.10–1.11: under 20 s on the page —
    10 spam, 0 «Kerakli»/«Sotildi»; the form filled in under 12 s — ~8 spam, 0 good (a small sample,
    and most of it from the days the check was off, #31 → #46). `index.ts` flags `rushed` when
    `signals.pageMs` < `RUSHED_PAGE_MS` or `fillMs` < `RUSHED_FILL_MS` (0 = nothing typed counts),
    main site only; it is in `NO_INSTANT_LEAD_FLAGS` and nothing else: «Lidlar», panel and group as
    usual («juda tez yuborilgan …»), `meta_pending` with `lead_sent = 0`, so «Kerakli»/«Sotildi» still
    sends the Lead. Partner unchanged (#3). Their step 5 («Spam» tab sends no Lead) was already true.
    Later the same day (owner, re-pasting «sifatli lead 0 ta»): `rushed` moved into
    `MAIN_SPAM_SHEET_FLAGS` — «Spam» tab, not «Lidlar»; still in the group and the panel, not refused
    (a refused sender would only try again slower; the repo is public). A real customer sent fast
    (autofill + «Ҳа») lands there too: worth a look at «juda tez» rows in «Spam» now and then.
    `fillMs` starts at the first `input` event, so an Instagram autofill sent at once is usually
    `rushed` too. The owner says autofilled orders are many, so (same day, owner's yes) the main
    site's form asks once when the number came from autofill (`phoneAutofilled`): the first «send»
    shows «Мутахассисимиз шу рақамга қўнғироқ қилади: +998 … Бу рақам ҳозир ишлайдими?» with
    [Ҳа, шу рақам ишлайди] (sends; `requestSubmit`) / [Йўқ, бошқа рақам ёзаман] (empties the field).
    The owner's wording: «мутахассис», not «оператор». `ConfirmAutofillContext` (OrderForm.tsx),
    provided only by sites/classic; partner unchanged. Typed or pasted numbers never see it. Ships
    with the Worker deploy (workers.dev) and `deploy:site` (zeynara.com.uz).
    Domain verification for zeynara.com.uz (Meta Business portfolio): advised the DNS TXT record
    over the `<meta>` tag — no code, nothing in the public repo, and index.html is shared with the
    partner build (#2).
    Same day the targetologist made the main Pixel's Traffic permissions allow list (zeynara.com.uz
    + workers.dev). The CAPI `event_source_url` is the order's Referer (the domain's Pages function
    keeps it), so workers.dev must stay listed while any ad points there.

50. **A number marked spam goes to «Spam» when it orders again; a copied ad link is named**
    (2026-11-01, owner's request). `spam_marks` gained `phone_hash` (filled for old marks on
    migration from `leads` / `partner_leads` by `source`); 🚫, «Keraksiz»/«Spam» in either sheet store
    it. `spamFlags` → `spam_phone` («bu raqam avval spam belgilangan»), in `MAIN_SPAM_SHEET_FLAGS`
    («Spam» tab, no Lead). Within `DUPLICATE_WINDOW_HOURS` (24) the same number is a repeat, not a new
    order, so this acts from the next day on, for 30 days. Partner: a warning only (#3 unchanged).
    «Copied link»: a page cannot see a copy. `link_copied` (main site, information only, still «Lidlar»
    and an instant Lead) = the ad's click id (fbclid / `_fbc`) and a user agent not from the
    Instagram/Facebook app — copied out of the app, or «open in browser», a computer, Audience Network.
    The same click id behind another number's order stays `reused_click` (#24).

51. **A call from the site — microphone test first** (2026-11-04, owner's idea): a 📞 button on the site,
    enabled 9:00–19:00, that rings the operators' installed app (the panel PWA); **neither side sees a
    phone number** (owner's requirement). Planned as our own WebRTC voice call: signalling over a Durable
    Object WebSocket, STUN (+ Cloudflare TURN if needed), ringing in the panel, «Operatorlar band» → the
    form after ~30 s, each call logged in the group with its ad. Advised to enable the button only while
    an operator is online. Risks told: Instagram's in-app browser may not hand over the microphone (most
    customers open the site there); a closed PWA cannot ring like a phone (a push notification at best,
    weak on iPhone), so the panel must stay open; older customers vs the microphone prompt. Alternative
    offered: a plain phone number 9–19 (the owner then asked that the number stay hidden).
    Step 1 built: `GET /mic-test` on the Worker (`src/mic-test.ts` + `mic-test.html`, in
    `run_worker_first`): microphone, a level meter, a WebRTC loop on the phone itself, a STUN check; the
    owner screenshots the result from Instagram on Android and iPhone. Nothing is recorded or sent.
    Note for the real button: the site's own pages send `Permissions-Policy: microphone=()` (apps/web
    vite.config.ts `_headers`, also on zeynara.com.uz) — it must become `microphone=(self)` there.

52. **Marked spam comes back silent** (2026-11-04, owner: «shu qurilmadan yoki nomerdan spam tushgan
    bo'lsa, qaytib tushmasligi kerak»). Read of the main sheet that day: «Spam» tab 25–26 rows a day on
    3–4 Nov, 42 of 51 one script (webdriver, ~70 s to fill, rotating flagship models, a copied ad link
    with the same fbclid); repeats of marked numbers were already diverted since #50 (№288). The real
    leak is first-time junk in «Lidlar»: 28 of 75 rows since 1 Nov marked «Spam» by operators, each a
    new number and phone, mostly iPhones (= Instagram app, so no Turnstile under #46), each an instant
    CAPI Lead (#32). Next lever, the owner's call: the check inside the app too (#46).
    Built: `SILENT_FLAGS` (`spam_device`, `spam_phone`) — main-site order accepted, written to the «Spam»
    tab only, never posted to the group (`list_items.hidden = 2`; repeats and the concern reply under it
    are not posted either); `spam_phone` joined `LIKELY_BOT_FLAGS` (out of the panel). A bot trap's
    device id is remembered (`spam_marks` source `trap:<id>`, `ip_hash` '', no phone/fingerprint: bots
    type strangers' numbers and pose as common phones). `spam_lookalike` and `spam_source` unchanged
    (guesses). Bot-trap orders themselves still reach the group (#13) — ask before changing that.

53. **Spam audit: what the sheet can now say, and no dialog on arrival** (2026-11-04). The owner pasted a
    generic 11-step anti-spam prompt («~90 % spam; the numbers are real, their owners say they left none»),
    then said mid-way **«sms tasdiqlash shart emas»** (the prompt's step 9, OTP: not built, do not offer it
    again unasked) and **«sayt ochilganida forma window pop-up bo'lmasin»**: `popup={false}` in
    sites/classic (the dialog only ever opened on arrival, no button depends on it; the partner keeps
    it). Watch orders after it: #34 is what happened the last time, though the form was far down then.
    Most of the prompt already existed (sheet URL only in Worker secrets and never in the repo's history
    or builds, `LEAD_SECRET`, validation, honeypot as a flag, `rushed`, Turnstile, 24-hour repeats). Added:
    (a) **Main sheet columns** by header name (`LOG_HEADERS`): Status, Sabab, IP, User-Agent, Referrer,
    fbclid, utm_source, Forma (s), Saytda (s). The script fills only headers already in the tab's first
    row, so the owner types them in «Lidlar» and «Spam»; until then nothing changes. «Status» = `ok` when
    the order got the instant Lead, else `shubhali` (`NO_INSTANT_LEAD_FLAGS`, no rule of its own). «Sabab» =
    short codes (`REASON_CODE`, legend in docs/SPAM.md), because «Belgi» is not written in «Lidlar» (the
    owner's dropdown). `SheetOrder.log` is main-only: the partner's row stays byte for byte (#2).
    IP in the clear is the owner's explicit request and a change from docs/SECURITY.md; the targetologist
    reads this sheet (#49), and leaving the «IP» header out keeps the column empty.
    (b) **A repeat within 24 h** notes «Takror» on the order's own row (`sendSheetNote`, `SHEETS_NOTES`).
    (c) **Silent check inside the Instagram / Facebook app** (`silentCheck` in OrderForm): Turnstile runs
    off-screen, its token goes with the order if ready, it is dropped the moment it wants interaction, and
    nothing awaits it (not even the script). The server only notes a failure in «Sabab» (`appCheckCode`:
    `captcha_savol_ilova` it wanted a person, `captcha_fail_ilova` token refused, `captcha_xato_ilova` it
    failed to run, `captcha_yoq_ilova` no token and no reason, which includes old cached pages for the
    first days; `log.info`, not flags: same tab, same instant Lead, nothing in the group or panel). #31 and
    #46 stand: nobody in the app is asked or held, though an order with a token now also waits for
    siteverify (usually well under a second, 5 s at most). Purpose: two weeks of data on whether it tells spam from
    customers. **It says nothing yet**; only the owner decides whether it ever routes an order.
    (d) `fbclid_yoq` in «Sabab» only: it decides nothing. (e) First decoy renamed `hp_x7k2` (the input only: the JSON key stays
    `contactFax`, cached pages post it and the schema is strict; `website` stays as bait, #14).
    Verified locally with Turnstile's test keys and a faked Instagram user agent, the request intercepted:
    pass → token in 1.7 s, never on screen; forced challenge → removed, no token; blocked → no token; each
    sent within ~80 ms. **Not tested in the real Instagram app, Safari or Android Chrome**, nor autofill on
    them: `honeypot_avto` in «Sabab» is how a filled decoy on a real phone will show. Known hole left open:
    the in-app exemption trusts the user agent, and the repo is public, so a script can claim Instagram.
    Deploy: `deploy` (Worker) first, then `deploy:site`; no `deploy:t2`.

54. **Main site: the network limits are back** (2026-11-04, owner: «Bitta tarmoqdan soatiga 3 urinish, kuniga
    3 ta raqam — buni qaytarish kerak», after comparing with 25–28.10, the days of good leads). `check` and
    `numbersToday` hold the main site's network to `IP_ORDERS_PER_HOUR` and `LEADS_PER_IP_PER_DAY`, on top of
    the per-device limits, which stay. From #35 until now they counted the browser's own id, which a script
    replaces on every post. **Partner site unchanged** (#2, its network cap stays 30): say so if the owner
    wants it too. Known cost, told to the owner: CGNAT (#35). A refused customer sees «try later», and with
    `site.phone` null has no number to call, so it conflicts with the 2026-11-04 prompt's «no real customer
    lost»; the owner chose knowing that. Watch «🚧 Лимит сабабли» in /hisobot. Worth knowing: this makes
    `multi_phone_ip` unreachable on the main site (the limit stops the order first) and made #53's `ip_tez`
    pointless, so it was removed. Checked before building, with empty posts refused by validation (nothing
    recorded) and `wrangler tail`: an order through zeynara.com.uz reaches the Worker with the sender's real
    `cf-connecting-ip`, so the domain's orders are not all counted as one network. Needs only `deploy`.

55. **The page opens at its top** (2026-11-05, owner: zeynara.com.uz opened at the very bottom). A fresh
    open was already at the top on all five set-ups tried (WebKit and Chromium builds with phone and
    Instagram user agents, desktop). Reloaded or reopened, the browser returned to the last place, and since
    the prerender (#39) it can do so at once. `openAtTop` in `main.tsx`: `history.scrollRestoration =
    'manual'`, back to the top unless the visitor has touched the page; a `#section` link stays App.tsx's.
    Shared code: the partner site gets it only with `deploy:t2`. Live on both addresses the same day; the owner confirmed it on their phone.

56. **«Қайси вилоятдансиз?» on the thank-you screen: built and removed the same day** (2026-11-05, owner, after
    trying it: «keraksiz ekan»). The page no longer asks. `POST /api/leads/region`, `regionAnswerSchema`, `REGIONS`,
    `addRegion` and `list_items.region` stay, so a page still in a browser's cache loses nothing; a «Viloyat» column
    may exist in the sheet's tabs from that day (delete it by hand if unwanted). Ask before bringing the question back.

57. **The phone moves on to the Telegram channel after the thank-you questions** (2026-11-05, owner, after a
    rival's site did so; the rival's front page had no form, so its method was not seen). `AfterOrderQuestions`
    (`TelegramChannelContext`, main site only, set in sites/classic; the partner build has no trace of it): the
    last tap, answered or skipped, runs `location.assign('https://t.me/zeynare')` 350 ms later, and «Телеграм
    каналимизга ўтиш» stays as a real link. Not on arrival of the order: that would leave #44's question
    unanswered (ask the owner before moving it). Whoever ignores the questions stays on the page: no timer. A repeat of a number within 24 h gets no
    questions (no `submissionId`), so no move and no link either: test with a number not used that day.
    Its answer uses `keepalive`, or the move would cancel it. @zeynare is a channel, not a group: customers
    cannot write there, and subscribing is their own tap. It had 1 subscriber and almost no posts that day; the
    owner was told. Real-phone behaviour varies (Instagram's browser may show the t.me page in place, with its
    own button), tested in engines. The owner's words after trying it on a phone: «guruh ochildi». Live on both addresses.
    The owner also wrote that @bionexecobot was added to «guruh» (read as this channel; whether it is an admin
    there is unknown) and asked it to greet every customer and push for an order. Nothing built yet. What Telegram
    allows (Bot API docs, checked 2026-11-05): a bot can write only to someone who pressed Start, so never to a site
    visitor; a channel post goes to every subscriber, so no personal greeting there. `chat_join_request` comes only
    if the bot has `can_invite_users`; its `user_chat_id` works for 5 minutes, until the request is processed. That
    needs an invite link with `creates_join_request` in place of t.me/zeynare (the plain @username joins with no
    request), the bot approving each request, and the update in `allowed_updates` with a `WEBHOOK_VERSION` bump,
    which drops pending updates (#40). Today the bot ignores the channel: no `channel_post` in `allowed_updates`,
    and `telegramCommand` drops chats other than `TELEGRAM_CHAT_ID`. Whatever is built: someone arriving from the
    thank-you page has already ordered, so confirm and never ask again; at most one greeting and one reminder,
    because this same bot carries every order to the operators and spam reports could get it restricted.

58. **Main sheet: tab «V2 30-65+» merged back into «Lidlar»** (2026-11-05, owner: «birlashtir», without resetting Meta). The
    live Apps Script had gained `ADSET_SHEETS` on 2026-11-04 (version 7; not in docs/main-sheet-script.js, written by no
    session of this project): orders of ad set «V2 | UZ 30-65+» went to their own tab, and `statuses` / `note_` read it too.
    Version 8 (same deployment, same URL) has the map empty: those orders go to «Lidlar» again and only «Lidlar» is read for
    «Holat». The helper functions stay in the live script, doing nothing. №398, №401, №402 were moved with their numbers, by
    header name (a one-off function, removed again; plain copy would shift the columns, as «Lidlar» has «Viloyat» and the tab
    did not). The tab is empty and nothing reads it, so the owner may delete it; a filter on «Ad set» in «Lidlar» shows V2's
    orders. To split again: one line in `ADSET_SHEETS` and a new version. Worker, ads and Meta untouched.
    Seen the same morning: №403 (webdriver, correct in «Spam») was also pasted into «Lidlar» by a person at 09:58, one column
    off, because «Spam» kept its columns in another order. The same day (owner's yes) the columns of «Spam» were moved so its
    first 15 match «Lidlar» (№ … Meta; the empty «Yosh» is last, kept), and a row copied by hand (#26) now lands right. The
    script writes by header name, so the order is free: keep the two tabs alike. №403's row in «Lidlar» was left as pasted.
    №399 is in no tab; the script log has a clean write at 07:57 that may be it. Ask, don't assume.

59. **www.zeynara.com.uz is in `MAIN_SITE_HOSTS`** (2026-11-05, the group's alert «сайт манзили … Hostnames рўйхатида йўқ»). The
    Pages site serves www too. Cloudflare's widget lets subdomains through and issued a token there (seen in Chrome), but the
    Worker compares the solved host exactly, so it answered `hostname-mismatch`. The alert's wording blames Cloudflare's list; here
    it was ours, and nothing in Cloudflare needed changing. Since #53 the in-app silent check sends tokens too, which is probably why
    it surfaced now. Harm: a plain browser on www went to «Spam»; only one failed-check row since 31.10 has no other sign (11-04
    13:34, iPhone), and whether it came from www is unknown. Needs only a Worker deploy, not `deploy:site`.
    Same day, the owner's question why the partner has less spam. Read of both sheets, in «Lidlar» shares (good = Kerakli + Sotildi,
    bad = Spam + Keraksiz; partner vs main): 25–28.10 70/20 vs 74/13; 29–31.10 83/9 vs 38/38; 1–2.11 65/19 vs 43/43; 3–5.11 24/61 vs
    32/39. The main site's slide starts on 29.10, when the check left the in-app browser (#31) and the instant Lead began (#32), so
    the two cannot be told apart. iPhones on the main site: 2 of 31 until 28.10, then 40 of 140 (3 good, 26 bad); partner 22 of 444
    (13 good, 6 bad). iPhone + «dastur bosgan» on main since 29.10: 16 rows, 0 good, 12 bad (#29 keeps it a warning). The partner's 2–4.11
    spike does not count: the owner says its Instagram was off those days (#60). Main: 52 of 85 rows on 1–5.11 have no «Ad set». The main
    sheet has no «Sabab» / «User-Agent» headers, so #53's measurement is not being kept. Nothing was changed on this; all the owner's call.

60. **«Copy the partner's site?» — read of 2026-11-05, nothing changed yet** (owner: $100 budget, 7–8 leads; partner $150, 30+, and the
    partner's 2–4.11 spam came from its Instagram being off, so those days don't count). A first read that counted them said quality was
    equal, junk 77 % vs 78 %, and the 30-50 ad set cleanest: all withdrawn. Good / bad % of marked rows, without 2–4.11: 25–28.10 partner
    70/20 vs main 74/13; 29.10–1.11 + 5.11 partner 77/12 (158 rows) vs main 39/43 (80 rows; with 2–4.11 still 38/40). In that second span:
    Android not rushed, partner 76/13 (139) vs main 58/26 (50), while on 25–28.10 it was 69/19 vs 76/14; iPhone, partner 10 rows 8 good 2 bad
    vs main 21 rows 2 good 15 bad; rushed Android, partner 9 rows 7/0 vs main 9 rows 1/5. Partner ad sets: 30-50 72 %, 30-65 67 %, A- 68 %
    good, no difference. So the split starts 29.10, when the check left the in-app browser (#31). Also new then: the instant Lead (#32, the
    partner has one too) and V1 (began 30.10), so not proven. A failed check on the partner since 29.10: 6 of 158 rows, 2 good 0 bad, and they
    still reach its sheet. A good lead cost about the same: main 30.10–2.11 $174 / 32 = $5.5; partner 30.10–1.11 67 on the owner's stated
    $100–150/day = $4.5–6.7 (its real spend is unknown here; its sheet has no «Sotildi», so «Kerakli» may be looser). Our filters on the
    partner's 287 rows take 23, 12 of them good; `rushed` takes 16 with 12 good, so it acts as a stand-in for the check. No row carries «bir
    nechta raqam», but refused orders reach no sheet: the check is «🚧 Лимит сабабли» in the 20:00 report. A 7-minute `wrangler tail` proved nothing.
    Advised: copy the check, not the whole page (the page would lose the discount the ad promises, the videos, the certificate). The owner's
    call (#46). If yes, a 3-day test: in-app check on, a failed check into «Lidlar» with «!» as on the partner, `rushed` off; judge by good
    share and cost per good lead. «Lidlar» rows may fall as junk leaves it: say so.
    Today is too early to read: by 11:13 «Lidlar» had 7 rows against 7, 4, 8, 12 on 1–4.11. LPV → «Lidlar» row: 2.11 15 %, 3.11 13 % (V1 $20.63),
    4.11 19 % (V1 $58.97), 5.11 by 11:20 5 % (V1 $22.04 and V2 $15.48, 146 LPV, 7 rows; a morning against whole days). V2 began on 5.11 on
    QualifiedLead, $50 of the day's $100, still learning. The dialog was turned off on the evening of 4.11 (#53); that it matters is a guess:
    raise it only if V1's full-day rate for 5.11 stays near 5 %. Ads Manager's «Проверить и опубликовать (17)» would also publish pending
    edits on V1's running ads, which can restart learning.
    The owner then: «umumiy leadlar soni juda kam». Count follows spend: main 30.10–2.11 ~$44/day, ~20 rows/day, ~$2.2 a row; partner 30.10–1.11 stated
    $100–150/day, ~30 rows/day, $3.4–5 a row. Today half of $100 is on V2 (QualifiedLead, 3 rows on $15.48), while the account makes ~44 good rows a week
    in all, under the ~50 one ad set needs (docs/TARGETING.md). Advised, not done: V2 off, drafts Z-A and Z-B (Lead, $30 each, not yet opened) on, publishing
    only those; the check test (above) after count recovers, since it does not raise count.

61. **«Leads fell after yesterday's change»: the site checked, the dialog back after 2 s** (2026-11-06). Checked live: all three
    addresses serve the same bundle; a phone run (Playwright, Instagram iOS/Android and plain Android Chrome user agents, the
    order post caught, Meta blocked) sends the order 0.1 s after the tap in the app and shows «Раҳмат!»; `wrangler tail` saw a
    real 201 at 12:24; the Facebook app on Android (`FB_IAB/FB4A`) is exempt from the check like Instagram and sends at once too.
    **No limit refusals** since #54 went live: zone analytics for zeynara.com.uz show POST /api/leads 429 ×4 on
    4.11, none on 5–6.11. **All of this is the domain only**: workers.dev is no zone, so its orders and refusals are not in it.
    The fall is in conversion, not in delivery: Uzbek phone page opens on the domain (`httpRequestsAdaptiveGroups`,
    country UZ, device mobile, GET / 200) vs 201 orders (bots included): 2.11 286 / 20 (7 %), 5.11 839 / 35 (4.2 %), 6.11 to 12:45
    212 / 5 (2.4 %). The fall began at 00:00 on 5.11, when opens tripled (an ad set's start time; V2 began that day): 00–07h 140 / 5
    (3.6 %), before the day's first deploy at 07:03; the 11–12h bump (83 / 12) was a blip. Facebook-app webviews came with it
    (ChromeMobileWebview 158 on 5.11 vs 10 in 2–4.11). US desktop «Unknown» opens come in bursts (4.11 22h 397, 5.11 22h 1 182,
    6.11 07h 537): Meta's robots checking the page, as when ads are published or edited. Read: the ads, not the site. The wrangler OAuth token reads zone
    GraphQL (path, method, status, country, device, browser) but not query, referrer or ASN. The domain's Cloudflare Web Analytics
    beacon is blocked by our CSP (harmless, so no RUM there).
    The owner asked for the order dialog back, «2 sekunddan keyin» (it was off since #53): `Landing` `popupAfterMs`, `OrderModal`
    `openAfterMs` = 2000 counted from navigation start (`performance.now()`), never sooner than 600 ms after hydration, and
    skipped if a form field has focus or a video plays with sound by then (#28: it once covered the videos). Partner unchanged (no prop: 600 ms after ready). Tested on the built page: opens at
    ~2.1 s; with the name field tapped at 1.2 s it does not open. Needs `deploy` (workers.dev) and `deploy:site` (the domain).
    Same day the owner asked to make the site «like the partner's»: advised as in #60 (the check, not the page).

62. **No discount; the form takes typing the moment the page is drawn** (2026-11-06). (a) Owner: «chegirma degan yozuvlarni
    butunlay olib tashlash kerak» — sites/classic no longer provides `OfferContext` (#41/#48 code stays in lib/offer.tsx): every
    ticket, «… чегирма билан буюртма» and «чегирмали нарх» falls back to the plain text, no `offerTap` is sent. Gulchehra opa's
    video (story-0) still says the discount at its end, and so does the ad itself: the owner's call.
    (b) Owner: «sherik saytida videolar yo'q … bizdagi sekin ochilsa kerak», then «juda sekin internetda ham forma 2-3 sekundda tayyor
    bo'lsin». Measured live (Playwright, Instagram Android UA, 4× CPU, Meta blocked; form ready = the name field takes typing):
    DevTools «Slow 3G» (0.4 Mbit/s, 400 ms) main 14.7 s vs partner 4.4 s; 1.6 Mbit/s main 3.2 s vs partner 1.5 s. The main page was
    drawn at once (1.2 s) but read-only until hydrated, and its script (122 KB) shared the line with ~400 KB of pictures far down the
    page: the seven video posters and the certificate (`loading="lazy"` does not help: Chrome fetches 2500 px ahead on slow
    networks). Now: `useNear` (sites/classic) gives the posters and the certificate their address only after hydration and within
    800 px of the screen (certificate keeps its box with width/height). `scripts/early.js` is inlined by prerender.mjs into the
    main page's <head> (its sha256 added to that build's `_headers` script-src; no 'unsafe-inline'; the partner build has neither).
    The fields still render `readOnly={!ready}`; early.js lifts it as each field is parsed (MutationObserver, then readystatechange;
    DOMContentLoaded would wait for the module script) and on touch/focus — so if early.js ever fails to run, the form only waits
    as before (a field open without early.js would send taps 0 / fillMs 0 → `bot_trap`/`rushed`, «Spam»). Until React takes over it
    records typing/paste/taps/made-up clicks (handed to lib/device.ts's counters, so `fillMs`/`keys`/`taps` read as before), a
    number put in by autofill (→ `phoneAutofilled`, the confirm question) and a press of the button / Enter on the number (the
    button pulses, `data-wait`; Enter on the name moves to the number). OrderForm's take-over effect copies the typed text into
    state (React 19 leaves a typed value on screen when hydrating, but its state is empty and the next re-render would wipe it)
    and sends a pressed order at once. `trackInitiateCheckout` called before `initPixel` (child effects run first) now waits for it.
    At the end of the body (first deploy) the script ran seconds after the form showed on the domain's slow-3G stream and a first
    letter was lost («лишер»): hence the <head>.
    Live, same throttling (Instagram Android UA, 4× CPU, Meta blocked, the order post caught): Slow 3G the form takes typing at
    1.3 s (partner 4.2 s); 1.6 Mbit/s 1.5 s (partner 1.4 s). Typed and «sent» at ~2.5 s on Slow 3G, the order left at ~7 s, when the
    script arrived, with the right name, number and signals (keys 15, fillMs ~5.3 s, taps 3), on zeynara.com.uz, www and
    workers.dev; an autofilled number got the confirm question; with early.js removed the fields stayed read-only until the script
    and the order still went. The 2-s dialog stays shut while a form field has text or an order is in (it covered the confirm
    question before that guard). Deployed by the agent on the owner's word («o'zing deploy qil ruxsat»), Worker version f983417d
    and Pages 519f87c8; not committed (the working tree also holds other sessions' uncommitted, already-live changes).
    The same day: domain-only numbers since it opened (UZ phones, GET / vs 201): 30.10–2.11 969 opens / 73 orders (7.5 %), 3–4.11
    bot-inflated, 5.11 839 / 35, 6.11 to 13:00 219 / 6. Opens are not people (repeats, Meta's prefetch). workers.dev, where the
    videos went live on 28.10, cannot be counted with this token (no path in Workers analytics; Workers Logs query: Forbidden).
    The partner is untouched (no deploy:t2).
    The owner confirmed today's domain orders against the sheet (00:46, 01:12, 06:33, 07:36 repeat, 08:18; 12:03 was their test):
    orders through zeynara.com.uz do arrive.
    Later the same day the owner: only ad set «V3» is on; V1 and V2 are off. V3's optimisation event, link and start time not yet known.

63. **The owner's own photos of the box replace the drawn pack** (2026-11-06, owner: «zeynara rasmlarini joyladim … hajmini reduce
    qilgin, saytga joylagin tiniq chiqqanlarini»). Ten iPhone HEICs (IMG_1270–1279, repo root, untracked: never commit them; they
    carry EXIF incl. orientation). Sharp at 100 %: 1270 (front, Cyrillic), 1271 (back, Russian), 1272 (front, Latin), 1273 (back, Uzbek),
    1274, 1275 (angled); soft: 1276, 1278, 1279; 1277 is a top-down angle. The drawn pack (public/images/zeynara/zeynara*.webp) is a
    render whose small print is misspelt («АРТЕРИАНОГО», «ОРТАНИЗМА»). Made with sips (HEIC → JPEG) and sharp (auto-rotate, crop,
    sharpen 0.5, WebP q60 / q70 for the back; sharp writes no metadata, GPS included) into `src/sites/classic/media/` (gitignored, like
    the videos): `pack-front-{360,540,720}` (1270), `pack-angle-{400,600,800}` (1275), `pack-latin-{400,600,800}` (1272),
    `pack-back-{600,1000}` (1273 cut above «ISHLAB CHIQARUVCHI»: both backs print the maker's address and phone,
    kept off the page so customers do not ring the maker instead of ordering). 22–98 KB each (151 KB for the 1000-px back).
    `ProductPhotoContext` (components/ui/ProductPack.tsx): when provided (sites/classic only), `ProductPack` shows the photo (rounded,
    no beating-heart overlay, which is aligned to the drawing) instead of the drawing, in AdHero's ProductStage (desktop only: the
    first screen hides it below 1024 px, so `heroHiddenMedia` puts a 1-px data: GIF `<source>` there and phones download nothing —
    before, they downloaded the 31 KB drawing they never saw) and in About («Маҳсулот ҳақида»), fetched near the screen only.
    `PackPhotos` in Proof, under the videos: «Маҳсулотнинг ҳақиқий суратлари», three cards (angle, Latin front, back), swipeable on
    phones, `useNear`, each a link to its largest file. The partner build has none of it (no provider, no files). Deployed the same
    day (Worker be1ed8ce, Pages 558bdb6c); slow-3G form still takes typing at ~1 s.

64. **workers.dev is the owner's one-ad test: the partner site's rules on the plain page** (2026-11-07). History: Worker version
    893f44f2 (2026-11-06 13:43 Tashkent, same login, not from this folder; its Worker code was byte-identical to this folder's, only
    its assets had no `sites/classic/media/`) left workers.dev showing the main page with every media part missing — what the partner
    page looks like. The owner wanted to test that with one ad, then «sherik sayti bilan bir xil qil», then «videolarni qo'shma, ui ni
    o'zgartirma, faqat sertifikatni qo'shsang bo'ladi». V3 (the only ad set on) points at zeynara.com.uz, so workers.dev is free.
    Built: **`npm run deploy` now builds `MAIN_PAGE=plain`** → `src/sites/classic/plain.tsx`: the original page + the certificate only
    (`certificate.tsx`, shared with index.tsx; its glob matches `certificate*.jpg` only, so no video or photo is even built), no
    concern question, no Telegram redirect, no autofilled-number question, the dialog 0.6 s after ready (`popupAfterMs={0}`, which keeps
    the «someone is filling in a form» guard: this page takes typing before hydration, the partner's does not). `VITE_HUMAN_CHECK` '1'
    (Turnstile for everyone, Instagram too, no silent check) and `VITE_ORDER_RULES` 'partner' → OrderForm sends `rules: 'partner'`
    (shared schema, `z.literal('partner').optional()`). **`deploy:full`** builds the full page for workers.dev, `deploy:site` is
    unchanged (zeynara.com.uz keeps the full page and the main rules; checked: its visible text equals live).
    Worker, `partnerRules` = main site + that marker: no in-app exemption (a failed check inside the app is `no_captcha`, «!» in
    «Lidlar»; outside also `likely_bot`); no `rushed`; a filled decoy is `honeypot` (no `decoy_filled`); the partner's network limits
    (`check` 30 an hour, `numbersToday` cap 30, per-device 3 kept); «Spam» tab = `PARTNER_SHEET_HIDDEN_FLAGS` + `SILENT_FLAGS`;
    instant CAPI Lead for everything but `TRAP_FLAGS` + `SILENT_FLAGS` — so, like the partner, a `likely_bot` order gets a Lead
    though it sits in «Spam». Kept from the main site on purpose: `bot_trap` = `programDriven` (#29), no browser Lead on our Pixel
    (principle #1, the server Lead does it), the group/panel behaviour, `meta_pending` (QualifiedLead / Purchase on the sheet's marks).
    `/spam N` re-exports by the main rules (a test-page in-app «!» order could be copied to «Spam» by it). Nothing marks a test-page
    order in Telegram: tell them apart by the ad set's name in «Ad set» (URL parameters on the test ad). Every test-page Lead goes to the
    same Bionex Eco dataset V3 learns from. Tests: 4 new (135). Checked with Turnstile test keys (pass: token, sent at once; forced
    challenge: the Uzbek hint, then sent without a token after ~8 s, as on the partner) and live on workers.dev (Worker 5c7e9d98), the
    order post caught. On slow 3G a «send» pressed before hydration now also waits for Turnstile (~15 s in the throttled test).
    To end the test: `deploy:full` (or decide what workers.dev should be) — and a deploy from another folder without media would
    again strip workers.dev's certificate.

65. **The partner site gets the Telegram channel link** (2026-11-07, owner: «sherik saytidan ham shu telegram guruhga qo'shilish
    button chiqsin»). `sites/partner.tsx` now wraps the original page in `TelegramChannelContext` (t.me/zeynare); #57's «the partner
    build has no trace of it» no longer holds. `AfterOrderQuestions` without `AskConcernContext` shows only «Телеграм каналимизга ўтиш»
    (`ChannelLink`): no concern question (its answer goes to the operators' group, principle #2) and no automatic move (on the partner
    the move would come as the order lands and could cut off the browser Pixel Lead, principle #3). Main site and plain page unchanged
    (checked by rendering the three variants). The t2 bundle still has no «bionex»; it grew 238 bytes. **But the channel page itself
    shows «@bionexecobot»** (description «Buyurtma berish yoki ma'lumot olish uchun @bionexecobot ni bosing» and a post), so a partner
    customer who taps sees the brand the partner's new Instagram account hides, and may order through our bot, past the partner's sheet.
    Committed, NOT deployed: the owner was asked to choose (edit the channel's description/post first, or deploy as is).

## Open items

- **Targetologist's Conversions API token** → `npx wrangler secret put META_T2_CAPI_TOKEN`
  (in `apps/worker`). Until then the partner Lead goes from the browser only.
  `/api/health` shows `partnerMeta`. For a test: `META_T2_TEST_EVENT_CODE`, delete afterwards.
- The targetologist was seen sending test events from **`zeynara.lovable.app`** (a separate
  site of theirs). Their ads must point to `https://zeynaraa-uz.pages.dev`, or leads miss the sheet.
- They tried Meta's code-free "Настройте события" tool on the partner site: not needed and
  blocked by the site's CSP. "Начало оформления заказа" they saw is `InitiateCheckout`, not a
  purchase. Their ad set should optimise for **Лид**.
- **Cloudflare WAF rate-limit** was proposed but needs an own domain (zone); `workers.dev` /
  `pages.dev` cannot have WAF rules. Do it if a domain is bought.
- A Claude Docs handover doc for the targetologist was started and left half-filled; it is
  superseded by `docs/PARTNER-SITE.md` («Targetologga nima beriladi»).
- Optional ideas offered, not requested: «2-сайт» mark in Telegram (moot now), a separate
  private sheet for main-site leads, a browser `SubmitApplication` event.

## Gotchas

- `wrangler types` pulls `.dev.vars` secrets into `worker-configuration.d.ts`; add only real
  vars by hand (secrets are typed optional in `src/secrets.d.ts`).
- Miniflare's `getBindings()` proxy rejects requests with an `Origin` header (tests omit it).
- Apps Script POST answers with a 302; follow it as GET (`curl -L` without `-X POST`).
- `IP_ORDERS_PER_HOUR` is 3: testing from one network hits it quickly; switch to mobile data.
- The sheet's «Belgi» column had the owner's own dropdown; system text there may show as invalid.

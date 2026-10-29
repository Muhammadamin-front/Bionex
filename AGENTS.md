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
    `proof` section between the hero and the first form (moved above it the same day): six real customers' videos — three filmed stories with the
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
    when the keyboard closes) and only scrolled to the form — the order was never sent. Main site:
    `Landing` `barOverForms={false}` hides the bar while either form is on screen. The partner page
    still has the bug (shared default `true`; ask before changing it there). Same day the owner saw no
    orders after 15:57 — no deploy happened then (09:38, 16:21 were the deploys); a live test order
    at ~18:20 returned 201 and logged no Telegram/Sheets error. Worker/DO invocations did fall after
    16:00, so look at the ads (edits put an ad back into review) before the code.

31. **No «not a robot» check on the main site** (2026-10-29, owner: their own phone, from the ad in
    Instagram, could not pass «Verify you are human»; on submit the form also waited up to 14 s
    «Текширилмоқда…»). Vite defines `VITE_HUMAN_CHECK` = '0' except for `--mode t2`; `OrderForm`
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

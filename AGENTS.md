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
npm test --workspace=@bionex/worker      # 78 tests, Miniflare
npm test --workspace=@bionex/shared      # 66 tests
npm run deploy --workspace=@bionex/worker      # main site + worker
npm run deploy:t2 --workspace=@bionex/worker   # partner site (Pages); deploy the worker FIRST
```
`apps/web/.env.production` and `apps/web/.env.t2` are gitignored (values are public: Turnstile
site key, site URL, Pixel id, `VITE_META_BROWSER_LEAD=1` for t2). They exist only on the
user's Mac.

## Principles already settled — do not undo without asking

1. **Main site: Meta `Lead` only after an operator confirms a real person** (✅ Сотилди or
   ❌ Рад этди). 🚫 Спам and unmarked orders are never reported. No browser `Lead` on the main
   site. Reason: 5 of the first 8 leads were fake; see `docs/META-CAPI.md`, `docs/SPAM.md`.
2. **The partner site is the targetologist's alone and must not reveal the main site**: no
   main Pixel, domain or "bionex" string in its build; its orders never reach the operators'
   Telegram group, CRM panel, lists or reports; main-site orders never reach its sheet/dataset.
3. **Partner site Lead is sent at once for every accepted form** (the owner's explicit
   choice, 2026-10-21): browser Pixel `Lead` (eventID = submissionId) + server CAPI `Lead`
   (same event_id) when `META_T2_CAPI_TOKEN` is set. A version that waited for the sheet's
   verdict was reverted.
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

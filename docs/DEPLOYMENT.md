# Publishing on Cloudflare

Everything runs on one Cloudflare Worker (free plan: 100,000 requests a day). The Worker
serves the website and handles orders; orders go to a Telegram group.

The Worker is named `zeynara` (`apps/worker/wrangler.jsonc`), so the site appears at
`https://zeynara.<your-subdomain>.workers.dev`. A new Cloudflare account picks its
`workers.dev` subdomain once (Workers & Pages); verify the account email first.

## 1. Telegram

1. In Telegram, open **@BotFather** → `/newbot` → give a name and a username ending in `bot`.
   Copy the token it gives.
2. Create a **private** group or channel for the operators and add the bot (in a channel: as an
   administrator with "Post messages"). Write any message there. The setup script refuses a
   public chat — orders contain customers' names and numbers.

## 2. Turnstile keys

Cloudflare dashboard → **Turnstile** → **Add widget**: hostname
`zeynara.<your-account>.workers.dev`, mode **Managed** → copy the **Site key** and the
**Secret key**. (See TURNSTILE.md.)

## 3. Website settings

Create `apps/web/.env.production`:

```bash
VITE_TURNSTILE_SITE_KEY=0x4AAAA...          # Site key (public)
VITE_SITE_URL=https://zeynara.<your-account>.workers.dev
VITE_META_PIXEL_ID=                        # optional: your own Pixel ID
```

`npm run deploy` refuses to publish with a Turnstile test key, an empty key or a non-https URL.

## 4. Publish

```bash
npx wrangler login        # opens the browser once
npm run deploy
npx wrangler secret put TURNSTILE_SECRET_KEY   # paste the Secret key
npm run telegram:setup    # checks the bot, finds the group, saves the two Telegram secrets
```

## 5. Check

1. Open `https://zeynara.<account>.workers.dev/api/health` →
   `"turnstileSecret": true, "telegram": true, "waitingForTelegram": 0`.
2. Place a test order from a phone (mobile data); it must appear in the group.
3. Errors: Cloudflare dashboard → Workers → zeynara → **Logs**.

## Alternative: deploy from GitHub (Workers Builds)

Cloudflare → Workers & Pages → Create → Import a repository → this repo, then:

| Field | Value |
|---|---|
| Project name | `zeynara` (must equal `name` in `apps/worker/wrangler.jsonc`) |
| Build command | `STRICT_PRODUCTION_BUILD=1 npm run build` (first deploy, before keys exist: `npm run build`) |
| Deploy command | `npx wrangler deploy -c apps/worker/wrangler.jsonc` |
| Preview builds | off (previews would share the order registry and the Telegram channel) |

Worker → Settings → **Build** → Variables: `VITE_TURNSTILE_SITE_KEY`, `VITE_SITE_URL`
(and `VITE_META_PIXEL_ID`). Worker → Settings → **Variables and Secrets** (type *Secret*):
`TURNSTILE_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Every push to `main`
redeploys.

## Own domain later

Cloudflare → Workers → zeynara → Settings → **Domains & Routes** → add `zeynara.uz`. Then add
the domain to the Turnstile widget's hostnames, update `VITE_SITE_URL`, and `npm run deploy`.

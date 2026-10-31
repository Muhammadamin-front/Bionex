// Secrets and optional settings that are not in wrangler.jsonc (set with `wrangler secret put`,
// or in .dev.vars locally). Merged into the Env type that `wrangler types` generates.
interface WorkerSecrets {
  TURNSTILE_SECRET_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  /** "1" = print orders in the terminal instead of sending them (local development only). */
  TELEGRAM_DRY_RUN?: string;
  /**
   * Meta Conversions API — the server-side copy of the "Lead" event. Both must be set or it
   * stays off. META_PIXEL_ID is the same dataset id the website's pixel uses; META_CAPI_TOKEN
   * comes from Events Manager → Settings → Conversions API → Generate access token.
   */
  META_PIXEL_ID?: string;
  META_CAPI_TOKEN?: string;
  /**
   * What one sold order is worth, as a plain number ("349000"), and its currency (default
   * "UZS"). Set it and "✅ Сотилди" also sends a Purchase event carrying that value, which is
   * what lets the ads eventually optimise for revenue instead of for confirmed leads. Leave
   * it unset and no Purchase is sent — better than feeding Meta a made-up figure.
   */
  META_ORDER_VALUE?: string;
  META_CURRENCY?: string;
  /** Events Manager → Test events: sends there instead of counting (remove when done). */
  META_TEST_EVENT_CODE?: string;
  /**
   * The partner site (sites.ts 't2'): its own Conversions API token (META_T2_PIXEL_ID is in
   * wrangler.jsonc) and test code, and the Apps Script web app of its Google Sheet with the
   * secret that script checks. Each part is off until its values are set.
   */
  META_T2_CAPI_TOKEN?: string;
  META_T2_TEST_EVENT_CODE?: string;
  SHEETS_T2_URL?: string;
  SHEETS_T2_SECRET?: string;
  /** The main site's own Google Sheet («Bionex-Zeynara»): a copy of every order. Off until both are set. */
  SHEETS_URL?: string;
  SHEETS_SECRET?: string;
  /**
   * The main site's own domain (e.g. «zeynara.com.uz»), once it is attached to this Worker. Set, the
   * old *.workers.dev address and «www.» send the page there (301, the ad's ?fbclid / utm kept), so
   * ads still pointing at the old link keep working. Unset: no redirect.
   */
  SITE_HOST?: string;
  /**
   * The main site's page served from other addresses (comma-separated, e.g. «zeynara.com.uz»: apps/site,
   * which forwards each order to this Worker's own address). A «not a robot» check solved there is ours.
   */
  MAIN_SITE_HOSTS?: string;
  /** '1' once the main sheet's Apps Script has the `note` action: the thank-you answer then goes to its «Shikoyat» column. */
  SHEETS_NOTES?: string;
  /** Test overrides for the outside services. */
  TELEGRAM_API_BASE?: string;
  TURNSTILE_VERIFY_URL?: string;
  META_API_BASE?: string;
}
interface Env extends WorkerSecrets {}
declare namespace Cloudflare {
  interface Env extends WorkerSecrets {}
}

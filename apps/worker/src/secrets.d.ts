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
  /** Events Manager → Test events: sends there instead of counting (remove when done). */
  META_TEST_EVENT_CODE?: string;
  /** Test overrides for the outside services. */
  TELEGRAM_API_BASE?: string;
  TURNSTILE_VERIFY_URL?: string;
  META_API_BASE?: string;
}
interface Env extends WorkerSecrets {}
declare namespace Cloudflare {
  interface Env extends WorkerSecrets {}
}

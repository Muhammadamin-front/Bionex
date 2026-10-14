// Secrets and optional settings that are not in wrangler.jsonc (set with `wrangler secret put`,
// or in .dev.vars locally). Merged into the Env type that `wrangler types` generates.
interface WorkerSecrets {
  TURNSTILE_SECRET_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  /** "1" = print orders in the terminal instead of sending them (local development only). */
  TELEGRAM_DRY_RUN?: string;
  /** Test overrides for the outside services. */
  TELEGRAM_API_BASE?: string;
  TURNSTILE_VERIFY_URL?: string;
}
interface Env extends WorkerSecrets {}
declare namespace Cloudflare {
  interface Env extends WorkerSecrets {}
}

/**
 * Cloudflare Turnstile, loaded on demand.
 *
 * The script is fetched only when the order form approaches the viewport (or gets
 * focus), so visitors who never scroll to the form never download it and the first
 * paint is not delayed.
 */

export interface TurnstileRenderOptions {
  sitekey: string;
  action?: string;
  cData?: string;
  appearance?: 'always' | 'execute' | 'interaction-only';
  size?: 'normal' | 'flexible' | 'compact';
  /** Widget language. Cloudflare has no Uzbek; see OrderForm for the choice. */
  language?: string;
  'refresh-expired'?: 'auto' | 'manual' | 'never';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: (code: string) => void;
  'timeout-callback'?: () => void;
}

interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<TurnstileApi> | null = null;

export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')));
    script.onerror = () => {
      loading = null; // allow a retry
      script.remove();
      reject(new Error('turnstile failed to load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

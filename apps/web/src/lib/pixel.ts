/**
 * Meta (Facebook) Pixel, as on the previous site — but loaded only after the page has
 * finished loading and the browser is idle, so it never delays the first paint.
 * Configure with VITE_META_PIXEL_ID; leave it empty to disable tracking entirely.
 */

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID ?? '';

export function initPixel(): void {
  if (!PIXEL_ID || window.fbq) return;
  // Never from a developer machine. A dev build that happens to see a production id would
  // otherwise add localhost traffic to the dataset, which Meta then has to learn to ignore.
  if (import.meta.env.DEV || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
  // Queue calls immediately; the real script replaces this stub when it arrives.
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
  fbq.disablePushState = true; // in-page #anchors are not new page views
  // No automatic events on the main site: the Pixel's own form and button detection was
  // reporting every filled-in form (spam included) as a Lead with no parameters, beside the
  // operator-confirmed Lead the Worker sends (Events Manager showed both, 2026-10-25). Must
  // come before 'init'. The partner site keeps its Pixel as its owner set it up.
  if (import.meta.env.VITE_META_BROWSER_LEAD !== '1') fbq('set', 'autoConfig', false, PIXEL_ID);
  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');

  const load = () => {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  };
  const whenIdle = () => {
    // Safari has no requestIdleCallback.
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(load, { timeout: 4000 });
    else setTimeout(load, 1500);
  };
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
}

let checkoutTracked = false;

/** First interaction with the order form. */
export function trackInitiateCheckout(): void {
  if (checkoutTracked) return;
  checkoutTracked = true;
  window.fbq?.('track', 'InitiateCheckout', { content_name: 'Zeynara' });
}

/**
 * The main site sends no `Lead` from here. A filled-in form is not a customer: its `Lead` is
 * sent by the Worker's Conversions API call, and only once an operator has rung the customer,
 * so the ads learn from people who really answer the phone. A browser-side `Lead` would fire
 * for every form — including the ones an operator later marks spam — and no amount of
 * de-duplication can take such an event back.
 *
 * The partner site (VITE_META_BROWSER_LEAD=1 in apps/web/.env.t2) is the exception, by its
 * owner's choice: every accepted form is their Lead, at once. It carries the order's
 * submissionId as eventID, the event_id of the same Lead from the Worker, so Meta counts one.
 */
export function trackLead(submissionId: string): void {
  if (import.meta.env.VITE_META_BROWSER_LEAD !== '1') return;
  window.fbq?.('track', 'Lead', { content_name: 'Zeynara' }, { eventID: submissionId });
}

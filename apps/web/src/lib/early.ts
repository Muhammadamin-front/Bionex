/**
 * What the visitor did on the prerendered main page before its script had arrived, as recorded by
 * scripts/early.js (inlined into the page by scripts/prerender.mjs; the partner page has none).
 *
 * Why (owner, 2026-11-06: «juda sekin internetda ham forma 2-3 sekundda tayyor bo'lsin»): on slow 3G the
 * page is drawn within a second but its script takes several more, and the form used to stay read-only
 * until then. Now the fields take typing at once; React keeps the typed text on screen while it takes
 * the page over, and OrderForm copies it into its state. Typing, taps, an autofilled number and a press of
 * «send» made in that time are kept here so that nothing differs from an order typed after the script ran
 * (the server's `rushed` and the autofill question both read them).
 */
export interface EarlyActions {
  /** performance.now() of the first change in any field, 0 if none. */
  first: number;
  keys: number;
  pasted: boolean;
  taps: number;
  synthetic: number;
  /** Phone fields a program filled in one go (autofill), not typed. */
  autofill: Element[];
  /** The form whose button or «send» key was pressed. */
  submit: HTMLFormElement | null;
  /** Set by lib/device.ts once its own counters run: early.js stops counting typing and taps. */
  done: boolean;
  /** Set once React has taken the page over: early.js stops recording entirely. */
  ready: boolean;
}

export function earlyActions(): EarlyActions | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { __bxEarly?: EarlyActions }).__bxEarly;
}

/**
 * The phone's model in words the people ringing customers can read ("SM-A135F · Android 13",
 * "iPhone14,2 · iOS 17.5"), shown next to an order so a run of fake orders from one handset
 * stands out. It is only what the browser says about itself, so a script can claim anything:
 * a hint for people, never a reason to refuse an order.
 *
 * Where it comes from: the in-app browsers of Facebook and Instagram (where most ad clicks
 * open) still name the model in their user agent; Chrome on Android replaced it with "K", and
 * names it only when asked (`navigator.userAgentData`, see apps/web lib/device.ts). Safari never
 * says which iPhone it is.
 */

const MAX = 80;

/** Keeps only what a model name is made of, so a value can never break a message or a cell. */
export function cleanDeviceModel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value
    .replace(/[^\p{L}\p{N} .,_()+/·-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX)
    .trim();
  return text || undefined;
}

/**
 * Whether the page was opened inside the Instagram or Facebook app, where an ad click opens.
 * On 2026-10-21 every real partner-site order came from there, and every fake one from a plain
 * Chrome that also failed the "not a robot" check (see the worker's `likely_bot` flag).
 */
export const fromSocialApp = (ua: string | null | undefined) => /Instagram|FBAN|FBAV|FB_IAB|FBIOS|FB4A/.test(ua ?? '');

const version = (v: string | undefined) => v?.replace(/_/g, '.').replace(/(\.0)+$/, '');

/** The model a user agent names, or at least its system; undefined when it names neither. */
export function modelFromUserAgent(ua: string | null | undefined): string | undefined {
  if (!ua) return undefined;
  // Facebook / Instagram in-app browsers: "FBDV/iPhone14,2", "FBDV/SM-A135F".
  // Instagram: "Instagram 451.0 (iPhone16,2; iOS 18_7; …)".
  const fbdv = /FBDV\/([^;]+)/.exec(ua)?.[1] ?? /\((iPhone\d+,\d+);/.exec(ua)?.[1];
  const ios = /\b(iPhone|iPad|iPod)\b.*?OS (\d+(?:_\d+)*)/.exec(ua);
  if (ios) return cleanDeviceModel(`${fbdv ?? ios[1]} · iOS ${version(ios[2])}`);
  const android = /Android (\d+(?:\.\d+)*)(?:;\s*([^;)]+))?/.exec(ua);
  if (android) {
    const fromUa = android[2]?.replace(/\s*Build\/.*$/, '').trim();
    // "K" (Chrome's stand-in), "wv" (WebView marker) and a bare locale say nothing about the phone.
    const model = fbdv ?? (fromUa && !/^(K|wv|[a-z]{2}[-_][a-z]{2})$/i.test(fromUa) ? fromUa : undefined);
    return cleanDeviceModel(model ? `${model} · Android ${version(android[1])}` : `Android ${version(android[1])}`);
  }
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux';
  return undefined;
}

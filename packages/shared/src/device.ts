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
 * Chrome that also failed the "not a robot" check (see the worker's `likely_bot` flag, a warning only).
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

/** What the browser reports about itself and the visit (apps/web lib/device.ts `deviceSignals`). */
export interface DeviceSignals {
  /** The graphics chip: "Adreno (TM) 750" on a phone, "NVIDIA GeForce …", "Intel …" on a computer. */
  gpu?: string;
  /** Touch points: 5–10 on a phone, usually 0 on a computer. */
  touch?: number;
  /** Set by browsers a program drives (Selenium, Puppeteer, Playwright). */
  webdriver?: boolean;
  /** From the first change in the form to sending it. 0: nothing was ever typed. */
  fillMs?: number;
  keys?: number;
  pasted?: boolean;
  /** Real touches (or mouse presses) on the page. 0 on a touch screen: nobody touched it. */
  taps?: number;
  /** Clicks a script made up (`isTrusted: false`) — only a program does that. */
  synthetic?: number;
  /** From opening the page to sending the order. */
  pageMs?: number;
  tz?: string;
  lang?: string;
  /** The visit came from an ad click (fbclid in the address, or Meta's _fbc cookie). */
  adClick?: boolean;
  /** Chrome's real major version, from userAgentData (the user agent string can be edited). */
  chrome?: string;
}

const short = (v: unknown, max: number) => cleanDeviceModel(typeof v === 'string' ? v : undefined)?.slice(0, max);
const count = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), max) : undefined);
const flag = (v: unknown) => (typeof v === 'boolean' ? v : undefined);

/** Whatever arrived, only the known fields in their shape: a bad value is dropped, never refused. */
export function cleanSignals(value: unknown): DeviceSignals | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  const out: DeviceSignals = {
    gpu: short(v.gpu, 80),
    touch: count(v.touch, 50),
    webdriver: flag(v.webdriver),
    fillMs: count(v.fillMs, 86_400_000),
    keys: count(v.keys, 10_000),
    pasted: flag(v.pasted),
    taps: count(v.taps, 100_000),
    synthetic: count(v.synthetic, 100_000),
    pageMs: count(v.pageMs, 86_400_000),
    tz: short(v.tz, 40),
    lang: short(v.lang, 20),
    adClick: flag(v.adClick),
    chrome: typeof v.chrome === 'string' && /^\d{1,4}$/.test(v.chrome) ? v.chrome : undefined,
  };
  for (const key of Object.keys(out) as Array<keyof DeviceSignals>) if (out[key] === undefined) delete out[key];
  return Object.keys(out).length ? out : undefined;
}

const WORDS = {
  latn: {
    noAd: 'reklama bosilmagan',
    webdriver: 'webdriver (dastur boshqargan)',
    touch: 'sensor',
    seconds: 'soniyada',
    keys: 'ta harf yozilgan',
    pasted: "nusxa qo'yilgan",
    noTyping: 'hech narsa yozilmagan',
    noTouch: 'ekranga tegilmagan',
    synthetic: 'dastur bosgan',
    onPage: 'saytda',
    really: 'aslida',
  },
  cyrl: {
    noAd: 'реклама босилмаган',
    webdriver: 'webdriver (дастур бошқарган)',
    touch: 'сенсор',
    seconds: 'сонияда',
    keys: 'та ҳарф ёзилган',
    pasted: 'нусха қўйилган',
    noTyping: 'ҳеч нарса ёзилмаган',
    noTouch: 'экранга тегилмаган',
    synthetic: 'дастур босган',
    onPage: 'сайтда',
    really: 'аслида',
  },
};

/**
 * A trap only a program falls into: a made-up click, a touch screen nobody touched before the
 * order was sent, or the automation mark. Missing signals (an old cached page) never count.
 */
export function caughtByBotTrap(s: DeviceSignals | undefined): boolean {
  if (!s) return false;
  return Boolean(s.webdriver) || Boolean(s.synthetic) || (s.taps === 0 && Boolean(s.touch));
}

/**
 * One short line for the people checking orders, e.g.
 * "reklama bosilmagan · GPU: NVIDIA GeForce RTX 3060 · sensor 0 · 2 soniyada · hech narsa yozilmagan · Asia/Tashkent · ru-RU".
 */
export function describeSignals(s: DeviceSignals | undefined, userAgent: string | null | undefined, script: 'latn' | 'cyrl'): string {
  if (!s) return '';
  const w = WORDS[script];
  const parts: string[] = [];
  if (s.adClick === false) parts.push(w.noAd);
  if (s.webdriver) parts.push(w.webdriver);
  if (s.gpu) parts.push(`GPU: ${s.gpu.replace(/^ANGLE \((.*)\)$/, '$1')}`);
  if (s.touch !== undefined) parts.push(`${w.touch} ${s.touch}`);
  if (s.fillMs !== undefined) parts.push(`${Math.round(s.fillMs / 1000)} ${w.seconds}`);
  if (s.keys) parts.push(`${s.keys} ${w.keys}`);
  if (s.pasted) parts.push(w.pasted);
  if (!s.keys && !s.pasted) parts.push(w.noTyping);
  if (s.synthetic) parts.push(`${w.synthetic} ×${s.synthetic}`);
  if (s.taps === 0 && s.touch) parts.push(w.noTouch);
  if (s.pageMs !== undefined) parts.push(`${w.onPage} ${Math.round(s.pageMs / 1000)} ${w.seconds}`);
  const claimed = /Chrome\/(\d+)/.exec(userAgent ?? '')?.[1];
  if (s.chrome && claimed && claimed !== s.chrome) parts.push(`Chrome ${claimed} (${w.really} ${s.chrome})`);
  if (s.tz) parts.push(s.tz);
  if (s.lang) parts.push(s.lang);
  return parts.join(' · ');
}

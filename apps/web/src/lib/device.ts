import { modelFromUserAgent, type DeviceSignals } from '@bionex/shared/device';
import { newSubmissionId } from './api';

const KEY = 'bx_device';

/**
 * A random id this browser keeps, sent with every order, so that an order marked spam also
 * marks the phone it came from: the next order from it arrives flagged even after it changes
 * network (docs/SPAM.md). Not a fingerprint — it is only what this site stored, and clearing
 * the site's data or a private window makes a new one. Missing when storage is blocked; the
 * order goes through regardless.
 */
export function deviceId(): string | undefined {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
      id = newSubmissionId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

let fingerprint: Promise<string | undefined> | undefined;

/**
 * A hash of what this phone's browser reports about itself — model and system (user agent),
 * screen, languages, time zone, processor and graphics, and how it draws a test image. It
 * survives what `deviceId` does not (cleared site data, a private window, a new network), so a
 * spam mark can still say "this looks like that phone" (docs/SPAM.md). It is a likeness, not
 * an identity: phones of the same model and system can share it, so it only ever flags an
 * order, never refuses one. Computed here, nothing is sent anywhere but our own server.
 */
export function deviceFingerprint(): Promise<string | undefined> {
  fingerprint ??= (async () => {
    try {
      const nav = navigator as Navigator & { deviceMemory?: number };
      const signals = [
        nav.userAgent,
        nav.language,
        (nav.languages ?? []).join(','),
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        `${screen.width}x${screen.height}x${screen.colorDepth}@${window.devicePixelRatio}`,
        nav.hardwareConcurrency,
        nav.deviceMemory,
        nav.maxTouchPoints,
        canvasSignal(),
        webglSignal(),
      ].join('|');
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signals));
      return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return undefined;
    }
  })();
  return fingerprint;
}

/** The same drawing comes out a little differently on different graphics hardware and fonts. */
function canvasSignal(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.textBaseline = 'top';
    ctx.font = '16px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(100, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Zeynara, Ўзбекистон 😊', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Zeynara, Ўзбекистон 😊', 4, 17);
    return canvas.toDataURL();
  } catch {
    return '';
  }
}

function webglSignal(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return '';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return info ? `${gl.getParameter(info.UNMASKED_VENDOR_WEBGL)}~${gl.getParameter(info.UNMASKED_RENDERER_WEBGL)}` : String(gl.getParameter(gl.RENDERER));
  } catch {
    return '';
  }
}

type Hints = { model?: string; platform?: string; platformVersion?: string; fullVersionList?: Array<{ brand: string; version: string }> };
let hints: Promise<Hints | undefined> | undefined;

/** What Chrome tells only when asked (other browsers have no `userAgentData`). */
function askHints(): Promise<Hints | undefined> {
  hints ??= (async () => {
    try {
      const data = (navigator as Navigator & { userAgentData?: { getHighEntropyValues(keys: string[]): Promise<Hints> } }).userAgentData;
      if (!data) return undefined;
      return await Promise.race([
        data.getHighEntropyValues(['model', 'platform', 'platformVersion', 'fullVersionList']),
        new Promise<undefined>((r) => setTimeout(r, 1_000)),
      ]);
    } catch {
      return undefined;
    }
  })();
  return hints;
}

let model: Promise<string | undefined> | undefined;

/**
 * The phone's model, for the people ringing the customer (see @bionex/shared device.ts).
 * Chrome on Android names it only when asked; elsewhere the user agent is all there is.
 */
export function deviceModel(): Promise<string | undefined> {
  model ??= (async () => {
    const fromUa = iphoneBySize(modelFromUserAgent(navigator.userAgent));
    try {
      const asked = await askHints();
      if (!asked?.model) return fromUa;
      return `${asked.model} · ${asked.platform || 'Android'} ${(asked.platformVersion ?? '').replace(/(\.0)+$/, '')}`.trim();
    } catch {
      return fromUa;
    }
  })();
  return model;
}

/**
 * Safari never says which iPhone it is; its screen size narrows it to a few models that share
 * one (in points, portrait, and the pixel density where two models differ only in that).
 */
const IPHONE_SIZES: Record<string, string> = {
  '320x568': 'iPhone SE (1)',
  '375x667': 'iPhone SE / 6 / 7 / 8',
  '414x736': 'iPhone 6 / 7 / 8 Plus',
  '375x812': 'iPhone X / XS / 11 Pro / 12 mini / 13 mini',
  '414x896@2': 'iPhone XR / 11',
  '414x896@3': 'iPhone XS Max / 11 Pro Max',
  '390x844': 'iPhone 12 / 13 / 14 / 16e',
  '428x926': 'iPhone 12 Pro Max / 13 Pro Max / 14 Plus',
  '393x852': 'iPhone 14 Pro / 15 / 15 Pro / 16',
  '430x932': 'iPhone 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus',
  '402x874': 'iPhone 16 Pro / 17 / 17 Pro',
  '420x912': 'iPhone Air',
  '440x956': 'iPhone 16 Pro Max / 17 Pro Max',
};

function iphoneBySize(model: string | undefined): string | undefined {
  if (!model?.startsWith('iPhone ·')) return model;
  try {
    const size = `${Math.min(screen.width, screen.height)}x${Math.max(screen.width, screen.height)}`;
    const name = IPHONE_SIZES[`${size}@${Math.round(window.devicePixelRatio)}`] ?? IPHONE_SIZES[size];
    return name ? model.replace(/^iPhone/, name) : model;
  } catch {
    return model;
  }
}

/**
 * How the form was filled: typed key by key, pasted, or set by a program (no typing at all).
 * Counted from the first change in any field of the page.
 */
const typing = { first: 0, keys: 0, pasted: false };
if (typeof document !== 'undefined') {
  document.addEventListener(
    'input',
    (e) => {
      typing.first ||= performance.now();
      const type = (e as InputEvent).inputType;
      if (type === 'insertText' || type === 'deleteContentBackward') typing.keys++;
      else if (type === 'insertFromPaste') typing.pasted = true;
    },
    true,
  );
}

/**
 * What tells a phone from a computer pretending to be one, and a person from a program
 * (docs/SPAM.md): graphics chip, touch points, the automation mark, how the form was filled,
 * the phone's time zone and language, whether the visit came from an ad click, and Chrome's
 * real version. Shown to the people checking orders as «Tafsilot»; never a reason to refuse.
 */
export async function deviceSignals(): Promise<DeviceSignals> {
  const asked = await askHints();
  const chrome = asked?.fullVersionList?.find((b) => /Chrome|Chromium/.test(b.brand))?.version.split('.')[0];
  let adClick = false;
  try {
    adClick = new URLSearchParams(location.search).has('fbclid') || /(^|;\s*)_fbc=/.test(document.cookie);
  } catch {
    /* no cookies in this browser */
  }
  return {
    gpu: gpuName(),
    touch: navigator.maxTouchPoints,
    webdriver: navigator.webdriver === true,
    fillMs: typing.first ? Math.round(performance.now() - typing.first) : 0,
    keys: typing.keys,
    pasted: typing.pasted,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lang: navigator.language,
    adClick,
    chrome,
  };
}

function gpuName(): string | undefined {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return undefined;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch {
    return undefined;
  }
}

import { modelFromUserAgent } from '@bionex/shared/device';
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

let model: Promise<string | undefined> | undefined;

/**
 * The phone's model, for the people ringing the customer (see @bionex/shared device.ts).
 * Chrome on Android names it only when asked; elsewhere the user agent is all there is.
 */
export function deviceModel(): Promise<string | undefined> {
  model ??= (async () => {
    const fromUa = modelFromUserAgent(navigator.userAgent);
    try {
      const hints = (navigator as Navigator & { userAgentData?: { getHighEntropyValues(keys: string[]): Promise<Record<string, string>> } }).userAgentData;
      if (!hints) return fromUa;
      const asked = await Promise.race([hints.getHighEntropyValues(['model', 'platform', 'platformVersion']), new Promise<undefined>((r) => setTimeout(r, 1_000))]);
      if (!asked?.model) return fromUa;
      return `${asked.model} · ${asked.platform || 'Android'} ${(asked.platformVersion ?? '').replace(/(\.0)+$/, '')}`.trim();
    } catch {
      return fromUa;
    }
  })();
  return model;
}

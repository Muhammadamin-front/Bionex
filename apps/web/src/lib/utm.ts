import { sanitizeUtm, type Utm } from '@bionex/shared/utm';

const KEY = 'bx_utm';

/**
 * Campaign attribution. If the landing URL carries utm_* parameters they win
 * (the latest campaign click); otherwise we reuse what this tab saw earlier, so a
 * reload or an in-page navigation does not lose the source.
 */
export function captureUtm(): Utm {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = sanitizeUtm({
    source: params.get('utm_source'),
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
    content: params.get('utm_content'),
  });
  try {
    if (Object.keys(fromUrl).length > 0) {
      sessionStorage.setItem(KEY, JSON.stringify(fromUrl));
      return fromUrl;
    }
    return sanitizeUtm(JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Record<string, unknown> | null);
  } catch {
    return fromUrl; // storage blocked (private mode, embedded browsers)
  }
}

import micTestHtml from './mic-test.html';

/**
 * GET /mic-test — whether a call from the site could work on a given phone and inside a given app
 * (owner, 2026-11-04: a «call» button that rings the operators' app, neither side seeing a number).
 * Most customers open the site inside Instagram, whose browser may not hand over the microphone, so
 * this is checked before anything is built: the microphone, its sound, a WebRTC loop on the phone
 * itself and whether STUN sees the phone from outside. Nothing is recorded or sent anywhere.
 * The site's own pages forbid the microphone (`Permissions-Policy` in apps/web vite.config.ts).
 */
export function micTestPage(): Response {
  const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return new Response(micTestHtml.replaceAll('{{NONCE}}', nonce), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
      'permissions-policy': 'microphone=(self), camera=(), geolocation=()',
      'content-security-policy': [
        "default-src 'none'",
        `script-src 'nonce-${nonce}'`,
        "style-src 'unsafe-inline'",
        "media-src 'self' blob: mediastream:",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
      ].join('; '),
    },
  });
}

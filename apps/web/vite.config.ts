import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import postcss, { type Declaration, type Plugin as PostcssPlugin } from 'postcss';
import postcssPresetEnv from 'postcss-preset-env';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const TURNSTILE = 'https://challenges.cloudflare.com';
const META = 'https://connect.facebook.net https://www.facebook.com';

/**
 * Oldest browsers the landing page must work in. Customers are mostly older people on
 * old phones that rarely update (Play Store updates only on Wi-Fi by default; old
 * iPhones stop at iOS 12–15), often opening the page inside the Facebook/Instagram app.
 */
const LEGACY_BROWSERS = ['chrome >= 70', 'and_chr >= 70', 'android >= 70', 'safari >= 12', 'ios_saf >= 12', 'samsung >= 10', 'firefox >= 68'];

/** Splits a CSS value on top-level spaces ("calc(a + b) 0" → ["calc(a + b)", "0"]). */
function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value.trim()) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ' ' && depth === 0) {
      if (current) parts.push(current);
      current = '';
    } else current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

/** `inset` (Chrome 87 / Safari 14.1) → also emit top/right/bottom/left for older browsers. */
const insetFallback: PostcssPlugin = {
  postcssPlugin: 'inset-fallback',
  Declaration: {
    inset(decl: Declaration) {
      const v = splitTopLevel(decl.value);
      if (v.length === 0 || v.length > 4) return;
      const [top, right = top, bottom = top, left = right] = v as [string, string?, string?, string?];
      for (const [prop, value] of [['top', top], ['right', right], ['bottom', bottom], ['left', left]] as const) {
        decl.cloneBefore({ prop, value });
      }
    },
  },
};

/**
 * Tailwind v4 targets Safari 16.4+ / Chrome 111+ and puts every rule inside CSS cascade
 * layers. Browsers without @layer (Chrome < 99, iOS Safari < 15.4) drop those blocks
 * entirely and show an unstyled page. This rewrites the built CSS once so it works there:
 * layers are flattened with equivalent specificity, logical properties get physical
 * fallbacks, and nesting / :is() are expanded. Modern browsers render it identically.
 */
function legacyBrowserCss(): Plugin {
  const processor = postcss([
    postcssPresetEnv({
      browsers: LEGACY_BROWSERS,
      stage: false,
      features: {
        'cascade-layers': true,
        'nesting-rules': true,
        'is-pseudo-class': true,
        'logical-properties-and-values': true,
        'logical-overflow': true,
        'float-clear-logical-values': true,
      },
      autoprefixer: { flexbox: 'no-2009', grid: false },
    }),
    insetFallback,
  ]);
  return {
    name: 'legacy-browser-css',
    apply: 'build',
    async generateBundle(_, bundle) {
      if (process.env.LEGACY_CSS === '0') return; // for comparing output only
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue;
        const result = await processor.process(String(file.source), { from: undefined });
        file.source = result.css;
      }
    },
  };
}

/**
 * Writes dist/_headers: Cloudflare applies these security headers and cache rules to every
 * file of the site (the order API sets its own headers in the Worker).
 */
function cloudflareHeaders(): Plugin {
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${TURNSTILE} https://connect.facebook.net`,
    `frame-src ${TURNSTILE}`,
    `connect-src 'self' ${TURNSTILE} ${META}`,
    "img-src 'self' data: https://www.facebook.com",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
  return {
    name: 'cloudflare-headers',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: [
          '/*',
          `  Content-Security-Policy: ${csp}`,
          '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
          '  X-Content-Type-Options: nosniff',
          '  X-Frame-Options: DENY',
          '  Referrer-Policy: strict-origin-when-cross-origin',
          '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
          '/assets/*',
          '  Cache-Control: public, max-age=31536000, immutable',
          '/images/*',
          '  Cache-Control: public, max-age=86400',
          '',
        ].join('\n'),
      });
    },
  };
}

/**
 * Mistakes that would silently lose every order in production. A Turnstile *test* site key
 * makes the real secret reject every order; a localhost site URL breaks link previews.
 */
function warnAboutProductionConfig(env: Record<string, string>): void {
  const problems: string[] = [];
  if (/^[123]x0000000000000000000/.test(env.VITE_TURNSTILE_SITE_KEY ?? '')) {
    problems.push('VITE_TURNSTILE_SITE_KEY is a Cloudflare TEST key: with the real secret on the server every order will be rejected.');
  }
  if (!env.VITE_TURNSTILE_SITE_KEY) problems.push('VITE_TURNSTILE_SITE_KEY is empty: the order form cannot work.');
  if (!/^https:\/\//.test(env.VITE_SITE_URL ?? '')) {
    problems.push('VITE_SITE_URL is not an https:// address: link previews (Telegram, Facebook) will show no image.');
  }
  if (problems.length > 0 && process.env.STRICT_PRODUCTION_BUILD === '1') {
    throw new Error(`Production build refused:\n- ${problems.join('\n- ')}`);
  }
  for (const p of problems) console.warn(`\n⚠️  ${p}`);
}

/**
 * The main site's own name and colour in the page head. The partner build keeps index.html as
 * it is: it must carry nothing of the main site (docs/PARTNER-SITE.md).
 */
const MAIN_SITE_NAME = 'Оромгоҳ даволаш маскани';
function mainSiteHead(): Plugin {
  return {
    name: 'main-site-head',
    transformIndexHtml(html) {
      return html
        .replace(/<title>([^<]*)<\/title>/, `<title>$1 · ${MAIN_SITE_NAME}</title>`)
        .replace(/(<meta property="og:site_name" content=")[^"]*"/, `$1${MAIN_SITE_NAME}"`)
        .replace(/(<meta name="theme-color" content=")[^"]*"/, '$1#eaf4fc"')
        .replace(
          /<link rel="icon"[^>]*>/,
          `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(MAIN_FAVICON)}" type="image/svg+xml" />`,
        );
    },
  };
}
/** A piyola in the paxta-guli blue, the main site's mark. */
const MAIN_FAVICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="12" fill="#eaf4fc"/><path d="M7 15h26c0 8.3-5.8 15-13 15S7 23.3 7 15Z" fill="#1d68b3"/><path d="M7.6 18.5h24.8" stroke="#bfe0fa" stroke-width="2"/><circle cx="20" cy="23.5" r="2.6" fill="#fff"/></svg>';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // MAIN_DESIGN=old: the main site keeps its previous look (the original page, the one the
  // partner site also uses) while everything else ships — the owner's way to deploy the
  // Worker and the form fixes before publishing the new design (npm run deploy:old-design).
  const oldPage = mode === 't2' || process.env.MAIN_DESIGN === 'old';
  // 'production' is the main site, 't2' the partner site (.env.t2): both go live.
  if (command === 'build' && mode !== 'development') warnAboutProductionConfig(env);
  return {
    plugins: [react(), tailwindcss(), legacyBrowserCss(), cloudflareHeaders(), ...(oldPage ? [] : [mainSiteHead()])],
    resolve: {
      // Each site is its own tree: the partner build never even sees the main site's page.
      alias: {
        '#site': fileURLToPath(new URL(oldPage ? './src/sites/partner.tsx' : './src/sites/main/index.tsx', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      // The order API runs in `wrangler dev` (apps/worker) during development.
      proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: false } },
    },
    build: {
      // Transpile JavaScript for the same old phones (see LEGACY_BROWSERS).
      target: ['es2019', 'chrome70', 'safari12', 'firefox68', 'edge79'],
      sourcemap: false,
    },
  };
});

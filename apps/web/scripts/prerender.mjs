/**
 * Puts the page's HTML into dist/index.html (`npm run build`; `build:site` passes dist-site): a phone shows the text and the
 * pictures as soon as the page arrives, instead of a blank screen until the script has loaded
 * and run. src/main.tsx then takes the drawn page over (hydrateRoot).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(web, process.argv[2] ?? 'dist');
const ssr = join(web, 'dist-ssr');

const { render } = await import(pathToFileURL(join(ssr, 'entry-server.js')).href);
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const EMPTY = '<div id="root"></div>';
if (!html.includes(EMPTY)) throw new Error(`${dist}/index.html has no empty <div id="root"></div> to fill`);
let page = html.replace(EMPTY, `<div id="root">${render()}</div>`);

// The stylesheet goes into the page itself: one round trip less before anything is drawn (the
// content security policy allows inline styles; its font addresses are absolute, /assets/…).
page = page.replace(/<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/, (_, href) => {
  const css = readFileSync(join(dist, href), 'utf8');
  if (css.includes('</style')) throw new Error(`${href} cannot be inlined`);
  return `<style>${css}</style>`;
});

// The form takes typing before the page's script arrives (scripts/early.js, src/lib/early.ts): inline in the
// <head>, so it runs before the form is even parsed (at the end of the page it ran seconds after the form
// showed on slow 3G); allowed by its hash in this build's content security policy (no 'unsafe-inline').
const early = readFileSync(join(web, 'scripts/early.js'), 'utf8');
if (early.includes('</script')) throw new Error('scripts/early.js cannot be inlined');
if (!page.includes('</head>')) throw new Error(`${dist}/index.html has no </head>`);
page = page.replace('</head>', `<script>${early}</script></head>`);
const headersFile = join(dist, '_headers');
const headers = readFileSync(headersFile, 'utf8');
const hash = `'sha256-${createHash('sha256').update(early).digest('base64')}'`;
if (!/script-src 'self'/.test(headers)) throw new Error(`${headersFile} has no script-src 'self' to add the hash to`);
writeFileSync(headersFile, headers.replace(/script-src 'self'(?: 'sha256-[^']+')?/, `script-src 'self' ${hash}`));

// Every local file the drawn page asks for must exist, or the page would show broken pictures.
const missing = [...page.matchAll(/(?:src|href|poster)="(\/[^"#?]*)"|(\/[^\s",]+\.(?:webp|jpg|png|svg|mp4))\s+\d+w/g)]
  .map((m) => m[1] ?? m[2])
  .filter((path) => !existsSync(join(dist, path)));
if (missing.length) throw new Error(`The prerendered page points at files that are not in dist/:\n${missing.join('\n')}`);

writeFileSync(join(dist, 'index.html'), page);
rmSync(ssr, { recursive: true, force: true });
console.log(`prerendered ${dist}/index.html (${Math.round(page.length / 1024)} kB)`);

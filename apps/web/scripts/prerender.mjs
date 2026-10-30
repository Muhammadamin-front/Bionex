/**
 * Puts the page's HTML into dist/index.html (`npm run build`): a phone shows the text and the
 * pictures as soon as the page arrives, instead of a blank screen until the script has loaded
 * and run. src/main.tsx then takes the drawn page over (hydrateRoot).
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(web, 'dist');
const ssr = join(web, 'dist-ssr');

const { render } = await import(pathToFileURL(join(ssr, 'entry-server.js')).href);
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const EMPTY = '<div id="root"></div>';
if (!html.includes(EMPTY)) throw new Error('dist/index.html has no empty <div id="root"></div> to fill');
let page = html.replace(EMPTY, `<div id="root">${render()}</div>`);

// The stylesheet goes into the page itself: one round trip less before anything is drawn (the
// content security policy allows inline styles; its font addresses are absolute, /assets/…).
page = page.replace(/<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/, (_, href) => {
  const css = readFileSync(join(dist, href), 'utf8');
  if (css.includes('</style')) throw new Error(`${href} cannot be inlined`);
  return `<style>${css}</style>`;
});

// Every local file the drawn page asks for must exist, or the page would show broken pictures.
const missing = [...page.matchAll(/(?:src|href|poster)="(\/[^"#?]*)"|(\/[^\s",]+\.(?:webp|jpg|png|svg|mp4))\s+\d+w/g)]
  .map((m) => m[1] ?? m[2])
  .filter((path) => !existsSync(join(dist, path)));
if (missing.length) throw new Error(`The prerendered page points at files that are not in dist/:\n${missing.join('\n')}`);

writeFileSync(join(dist, 'index.html'), page);
rmSync(ssr, { recursive: true, force: true });
console.log(`prerendered dist/index.html (${Math.round(page.length / 1024)} kB)`);

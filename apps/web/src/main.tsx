import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';

/**
 * The page opens at its top (owner, 2026-11-05: it opened at the very bottom). Reopened or reloaded,
 * a browser returns to where the last visit stopped, and a page that arrives already drawn lets it
 * do so at once. Never moves someone who has started scrolling; a link to a section is App.tsx's.
 */
function openAtTop() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (location.hash) return;
  let touched = false;
  const events = ['pointerdown', 'touchstart', 'wheel', 'keydown'] as const;
  for (const ev of events) {
    addEventListener(ev, () => (touched = true), { once: true, passive: true });
  }
  const toTop = () => {
    if (touched || window.scrollY === 0) return;
    // Overrides the page's smooth scrolling, which would run the whole page past the visitor.
    const html = document.documentElement;
    const before = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    html.style.scrollBehavior = before;
  };
  toTop();
  // A browser may still restore the old place as the page finishes loading.
  addEventListener('load', toTop, { once: true });
}
openAtTop();

// The main site's built page arrives already drawn (scripts/prerender.mjs): React takes it over
// instead of drawing it again. The partner build and `vite dev` serve an empty #root, drawn here.
const root = document.getElementById('root')!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);
if (root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);

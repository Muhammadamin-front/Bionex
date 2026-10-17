import { useEffect } from 'react';
import { Landing } from './components/landing/Landing';

/** Scroll to `el` at once, overriding the page's smooth scrolling (works in every browser). */
function jumpTo(el: Element) {
  const html = document.documentElement;
  const before = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto';
  el.scrollIntoView({ block: 'start' });
  html.style.scrollBehavior = before;
}

/**
 * A link straight to a section (an ad pointing at …/#tez-buyurtma): the browser looks for the
 * anchor before React has drawn the page, finds nothing and stays at the top. Jump once the
 * page is there, and again when fonts and images have settled the layout — unless the visitor
 * has started scrolling by then.
 */
function useScrollToHashOnLoad() {
  useEffect(() => {
    let id = '';
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    const el = id ? document.getElementById(id) : null;
    if (!el) return;

    let moved = false;
    const stop = () => {
      moved = true;
    };
    const align = () => {
      if (!moved) jumpTo(el);
    };
    const events = ['touchstart', 'wheel', 'keydown'] as const;
    for (const ev of events) addEventListener(ev, stop, { once: true, passive: true });
    align();
    void document.fonts?.ready.then(align);
    if (document.readyState !== 'complete') addEventListener('load', align, { once: true });
    const settle = window.setTimeout(align, 1500);
    return () => {
      moved = true;
      window.clearTimeout(settle);
      for (const ev of events) removeEventListener(ev, stop);
      removeEventListener('load', align);
    };
  }, []);
}

export function App() {
  useScrollToHashOnLoad();
  return <Landing />;
}

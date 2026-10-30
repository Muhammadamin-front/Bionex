import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { App } from './App';

/** The page's HTML at build time (scripts/prerender.mjs), so phones see it before the script runs. */
export function render(): string {
  return renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

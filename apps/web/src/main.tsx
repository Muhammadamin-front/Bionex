import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';

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

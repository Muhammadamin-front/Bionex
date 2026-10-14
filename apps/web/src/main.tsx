import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Brand display face, self-hosted; unicode-range keeps the download to the subsets used.
import '@fontsource-variable/montserrat/wght.css';
import './styles.css';

// Larger base font for older visitors.
document.documentElement.classList.add('landing');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

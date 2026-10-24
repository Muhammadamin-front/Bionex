import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Larger base font for older visitors.
document.documentElement.classList.add('landing');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

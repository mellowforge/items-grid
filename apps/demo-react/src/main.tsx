import '@mellowforge/items-grid-core/styles.css';
import 'demo-shared/demo.css';

import { restoreTheme } from 'demo-shared';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/app';

// The light/dark choice made on the landing page (or another demo) carries over.
restoreTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

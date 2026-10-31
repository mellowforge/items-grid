import '@fontsource-variable/inter';
import '@mellowforge/items-grid-core/styles.css';
import 'demo-shared/demo.css';
import './site.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

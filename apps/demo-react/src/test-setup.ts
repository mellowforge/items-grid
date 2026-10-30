import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-registers cleanup when vitest globals are on; this repo imports
// vitest APIs explicitly, so unmount between tests here.
afterEach(cleanup);

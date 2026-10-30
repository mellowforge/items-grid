import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const source = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Source-linked: the libraries resolve to their sources, so edits hot-reload with no rebuild.
    alias: [
      {
        find: /^@quietfoundry\/items-grid-core$/,
        replacement: source('../../packages/core/src/index.ts'),
      },
      {
        find: /^@quietfoundry\/items-grid-core\/styles\.css$/,
        replacement: source('../../packages/core/src/styles/items-grid.css'),
      },
      {
        find: /^@quietfoundry\/items-grid-react$/,
        replacement: source('../../packages/react/src/index.ts'),
      },
      { find: /^demo-shared$/, replacement: source('../demo-shared/src/index.ts') },
      { find: /^demo-shared\/(.*)$/, replacement: source('../demo-shared/src/$1') },
    ],
  },
  // Backstop against Vite serving a stale pre-bundled copy of a workspace library.
  optimizeDeps: { exclude: ['@quietfoundry/items-grid-core', '@quietfoundry/items-grid-react'] },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.tsx'],
    setupFiles: ['src/test-setup.ts'],
  },
});

import { copyFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  // Optional pager theme; layout never depends on it.
  onSuccess: async () => {
    copyFileSync('src/styles/items-grid.css', 'dist/styles.css');
  },
});

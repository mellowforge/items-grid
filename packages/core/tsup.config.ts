import { copyFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  // Optional theme for the pager and helpers; layout itself never depends on it.
  onSuccess: async () => {
    copyFileSync('src/styles/items-grid.css', 'dist/styles.css');
  },
});

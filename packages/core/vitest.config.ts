import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    // items-grid.css.spec.ts reads the stylesheet through `?raw`; vitest skips CSS otherwise.
    css: { include: [/items-grid\.css/] },
  },
});

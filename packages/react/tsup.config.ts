import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', '@mellowforge/items-grid-core'],
  // The component uses hooks and DOM refs, so it must be a client component under RSC.
  banner: { js: "'use client';" },
});

#!/usr/bin/env node
/**
 * Assembles the GitHub Pages site into `_site/`:
 *
 *   /           apps/site          (Vite, --base)
 *   /react/     apps/demo-react    (Vite, --base)
 *   /vanilla/   apps/demo-vanilla  (Vite, --base; consumes core from dist, so core builds first)
 *   /angular/   apps/demo-angular  (Angular CLI, --base-href)
 *
 * The base defaults to the project-site path `/items-grid/`; override it with PAGES_BASE
 * (e.g. "/" for a custom domain).
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '_site');
const base = (process.env.PAGES_BASE ?? '/items-grid/').replace(/\/?$/, '/');

const run = args => execFileSync('pnpm', args, { cwd: root, stdio: 'inherit' });

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

run(['--filter', '@mellowforge/items-grid-core', 'build']);

for (const [app, path] of [
  ['site', ''],
  ['demo-react', 'react/'],
  ['demo-vanilla', 'vanilla/'],
]) {
  run([
    '--filter',
    app,
    'exec',
    'vite',
    'build',
    '--base',
    `${base}${path}`,
    '--outDir',
    resolve(out, path),
    '--emptyOutDir',
  ]);
}

const angularOut = resolve(root, 'apps/demo-angular/dist/pages');
run([
  '--filter',
  'demo-angular',
  'exec',
  'ng',
  'build',
  '--base-href',
  `${base}angular/`,
  '--output-path',
  angularOut,
]);
cpSync(resolve(angularOut, 'browser'), resolve(out, 'angular'), { recursive: true });
rmSync(angularOut, { recursive: true, force: true });

console.log(`\nPages site assembled in _site/ for base ${base}`);

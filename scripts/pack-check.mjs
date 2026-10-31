#!/usr/bin/env node
/**
 * Packs every publishable package exactly as `pnpm publish` would (honouring
 * `publishConfig.directory` for @mellowforge/items-grid-angular) and checks each tarball:
 * required files present, no sources or specs, no `workspace:` specifier left
 * in the packed package.json, a LICENSE byte-identical to the root one, and
 * type declarations that resolve for every consumer (arethetypeswrong).
 * Run after `pnpm build`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// `attw` profiles: node16 covers CJS and ESM consumers; the Angular package is ESM-only.
const PACKAGES = [
  {
    dir: 'packages/core',
    attw: ['--profile', 'node16', '--exclude-entrypoints', 'styles.css'],
    required: ['dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'dist/styles.css'],
  },
  {
    dir: 'packages/react',
    attw: ['--profile', 'node16'],
    required: ['dist/index.js', 'dist/index.cjs', 'dist/index.d.ts'],
  },
  {
    dir: 'packages/angular/projects/items-grid',
    attw: ['--profile', 'esm-only'],
    required: [
      'fesm2022/mellowforge-items-grid-angular.mjs',
      'types/mellowforge-items-grid-angular.d.ts',
    ],
  },
];
const ALWAYS = ['package.json', 'README.md', 'LICENSE'];
const FORBIDDEN = [/^src\//, /\.spec\./, /^tsconfig/, /CLAUDE\.md$/];

const ROOT_LICENSE = readFileSync('LICENSE');

const destination = mkdtempSync(join(tmpdir(), 'items-grid-pack-'));
let failures = 0;

try {
  for (const pkg of PACKAGES) {
    const output = execFileSync('pnpm', ['pack', '--json', '--pack-destination', destination], {
      cwd: pkg.dir,
      encoding: 'utf8',
    });
    const { name, version, filename, files } = JSON.parse(output);
    const paths = files.map(file => file.path);
    const problems = [];

    for (const required of [...ALWAYS, ...pkg.required]) {
      if (!paths.includes(required)) problems.push(`missing ${required}`);
    }
    for (const path of paths) {
      if (FORBIDDEN.some(pattern => pattern.test(path))) problems.push(`should not ship ${path}`);
    }
    const manifest = execFileSync('tar', ['-xOf', filename, 'package/package.json'], {
      encoding: 'utf8',
    });
    if (paths.includes('LICENSE')) {
      const license = execFileSync('tar', ['-xOf', filename, 'package/LICENSE']);
      if (!license.equals(ROOT_LICENSE)) problems.push('LICENSE differs from the root LICENSE');
    }
    for (const [field, deps] of Object.entries(JSON.parse(manifest))) {
      if (!field.toLowerCase().includes('dependencies') || typeof deps !== 'object') continue;
      for (const [dep, range] of Object.entries(deps)) {
        if (String(range).startsWith('workspace:'))
          problems.push(`${field}.${dep} is still "${range}"`);
      }
    }

    try {
      execFileSync('pnpm', ['exec', 'attw', filename, '--format', 'ascii', ...pkg.attw], {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (error) {
      problems.push(
        `type declarations do not resolve for every consumer:\n${error.stdout ?? error}`
      );
    }

    console.log(`${problems.length ? '✗' : '✓'} ${name}@${version} — ${paths.length} files`);
    for (const path of paths.sort()) console.log(`    ${path}`);
    for (const problem of problems) console.error(`    ✗ ${problem}`);
    failures += problems.length;
  }
} finally {
  rmSync(destination, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\npack:check found ${failures} problem(s).`);
  process.exit(1);
}

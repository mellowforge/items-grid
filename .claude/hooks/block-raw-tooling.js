#!/usr/bin/env node
/**
 * PreToolUse hook for Bash. Tests: `pnpm test:hooks` (block-raw-tooling.test.js).
 *
 * Blocks four kinds of command that are wrong in this repository:
 *   - npm dependency commands and any yarn command: this is a pnpm workspace (`workspace:`
 *     protocol, `pnpm-lock.yaml`); npm or yarn would write a stray lockfile and break the links.
 *   - publishing: releases go through Changesets in CI (`.claude/rules/release.md`). An agent
 *     never runs `npm publish` / `pnpm publish` / `changeset publish` / the `release` script, in
 *     any spelling (flags, runners, wrappers like `sudo` or `bash -c '…'`).
 *   - pushing tags (`git push --tags`, a tag ref, `changeset tag`): tags come from the release.
 *   - `vitest` inside the Angular workspace (`packages/angular`): its specs need the TestBed
 *     environment that only `ng test` (`@angular/build:unit-test`) builds. In `packages/core`
 *     and `packages/react`, `pnpm exec vitest run <file>` is the documented single-file command.
 *
 * A hook is a guard rail, not a sandbox: the real control is npm-side (trusted publishing with
 * tokens disallowed, see release.md). It fails closed: an unreadable payload blocks.
 *
 * Exit codes: 0 — allow; 2 — block (stderr is shown to the agent as the reason).
 */

const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const ANGULAR = path.join(ROOT, 'packages', 'angular');
const ANGULAR_PACKAGES = new Set([
  'items-grid-angular-workspace',
  '@mellowforge/items-grid-angular',
]);

const MESSAGES = {
  install:
    'This is a pnpm workspace. Use `pnpm install` / `pnpm add <pkg> --filter <package>` (not npm or yarn).',
  publish:
    'Publishing is blocked for agents. Releases go through Changesets: add a changeset with `pnpm changeset`, and CI publishes when the release PR merges (see .claude/rules/release.md).',
  tags: 'Pushing tags is blocked for agents. Release tags come from the Changesets release (see .claude/rules/release.md).',
  vitest:
    'Direct `vitest` is blocked in the Angular workspace. Use `pnpm ng test --watch=false --include <spec>` from packages/angular (see CLAUDE.md, Commands).',
};

const PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'npx', 'bunx', 'node', 'changeset']);
const PUBLISH_WORDS = new Set(['publish', 'pub', 'unpublish', 'dist-tag']);
const NPM_INSTALL = new Set([
  'install',
  'i',
  'in',
  'isntall',
  'ci',
  'add',
  'uninstall',
  'un',
  'remove',
  'rm',
  'r',
  'update',
  'up',
  'upgrade',
]);
// Words that run the rest of the segment as a command.
const WRAPPERS = new Set([
  'sudo',
  'command',
  'builtin',
  'exec',
  'nohup',
  'time',
  'nice',
  'xargs',
  'corepack',
  'env',
  'timeout',
  'then',
  'else',
  'elif',
  'do',
  'if',
  'while',
  'until',
  '!',
]);
// Package-manager options that take a separate value.
const VALUE_FLAGS = new Set([
  '-F',
  '--filter',
  '--filter-prod',
  '-C',
  '--dir',
  '-w',
  '--workspace',
  '--prefix',
  '--userconfig',
]);

/** Drops heredoc bodies; returns the command and the bodies of `sh -c '…'` / `eval '…'`. */
const extractNested = command => {
  const nested = [];
  const withoutHeredocs = command.replace(
    /<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2[ \t]*(?=\n|$)/g,
    ''
  );
  const shellString =
    /(?:\b(?:ba|z|da|k)?sh\s+(?:-[a-zA-Z]+\s+)*-[a-zA-Z]*c[a-zA-Z]*|\beval)\s+(?:'([^']*)'|"((?:\\.|[^"\\])*)")/g;
  for (const match of withoutHeredocs.matchAll(shellString)) {
    nested.push(match[1] ?? match[2].replace(/\\(.)/g, '$1'));
  }
  return { command: withoutHeredocs, nested };
};

/**
 * Quoted text is not run: a quoted string with spaces (a commit message, a grep pattern)
 * becomes empty; a single quoted word (`"packages/angular"`) keeps its value.
 */
const unquote = command =>
  command
    .replace(/'([^']*)'/g, (_, body) => (/\s/.test(body) ? "''" : body))
    .replace(/"((?:\\.|[^"\\])*)"/g, (_, body) => (/\s/.test(body) ? '""' : body));

// One simple command per segment: split on `;`, `&&`, `||`, `|`, `&`, newlines, subshells,
// command substitution and braces.
const segments = command => command.split(/\|\||&&|[;|&\n(){}`]|\$\(/);

const basename = word => word.split('/').pop();

/** Strips env assignments and wrapper commands (`sudo`, `timeout 60`, `nice -n 5`, `env -i`). */
const stripWrappers = words => {
  let index = 0;
  while (index < words.length) {
    const word = words[index];
    if (/^\w+=/.test(word)) {
      index++;
    } else if (WRAPPERS.has(word)) {
      index++;
      // Wrapper options and their values (`-n 5`, `-i`, a `timeout` duration).
      while (
        index < words.length &&
        (/^-/.test(words[index]) || /^\d+[smhd]?$/.test(words[index]))
      ) {
        index++;
      }
    } else {
      break;
    }
  }
  return words.slice(index);
};

/**
 * The words after the head with their options removed, plus the directories and packages
 * that `-C` / `--dir` / `--prefix` / `--filter` point at.
 */
const parseArgs = words => {
  const positional = [];
  const dirs = [];
  const filters = [];
  const record = (flag, value) => {
    if (['-C', '--dir', '--prefix'].includes(flag)) dirs.push(value);
    if (['-F', '--filter', '--filter-prod'].includes(flag)) filters.push(value);
  };
  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    const inline = /^(--[\w-]+)=(.*)$/.exec(word);
    if (inline) {
      record(inline[1], inline[2]);
    } else if (VALUE_FLAGS.has(word)) {
      record(word, words[++index] ?? '');
    } else if (!word.startsWith('-')) {
      positional.push(word);
    }
  }
  return { positional, dirs, filters };
};

const isInAngularWorkspace = dir => {
  const relative = path.relative(ANGULAR, dir);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const isVitest = word => /^vitest(?:@\S*)?$/.test(basename(word));
const isChangeset = word =>
  /^(?:changeset|@changesets\/cli)(?:@\S*)?$/.test(word) ||
  basename(word) === 'changeset' ||
  /@changesets\/cli\/bin\.js$/.test(word);

const classifyGit = args => {
  const { positional } = parseArgs(args);
  if (positional[0] !== 'push') return null;
  if (args.some(word => word === '--tags' || word === '--follow-tags')) return 'tags';
  // A tag ref: refs/tags/…, a version (v1.2.3) or a Changesets tag (@scope/name@1.2.3).
  if (
    positional
      .slice(1)
      .some(
        word => /^refs\/tags\//.test(word) || /^v?\d+\.\d+/.test(word) || /@\d+\.\d+/.test(word)
      )
  ) {
    return 'tags';
  }
  return null;
};

/** Classifies one simple command, given the directory it runs in. */
const classify = (words, dir) => {
  const command = stripWrappers(words);
  if (command.length === 0) return null;
  const head = basename(command[0]);
  const args = command.slice(1);

  if (head === 'git') return classifyGit(args);
  if (isVitest(command[0])) return isInAngularWorkspace(dir) ? 'vitest' : null;
  if (!PACKAGE_MANAGERS.has(head) && !isChangeset(command[0])) return null;

  const { positional, dirs, filters } = parseArgs(args);
  if (positional.some(word => PUBLISH_WORDS.has(word))) return 'publish';
  const changesetAt = isChangeset(command[0]) ? -1 : positional.findIndex(isChangeset);
  if ((changesetAt !== -1 || isChangeset(command[0])) && positional[changesetAt + 1] === 'tag') {
    return 'tags';
  }
  const script = ['run', 'run-script'].includes(positional[0]) ? positional[1] : positional[0];
  if (['npm', 'pnpm', 'yarn'].includes(head) && script === 'release') return 'publish';
  if (head === 'yarn') return 'install';
  if (head === 'npm' && NPM_INSTALL.has(positional[0])) return 'install';

  if (positional.some(isVitest)) {
    const targetsAngular =
      dirs.some(target => isInAngularWorkspace(path.resolve(dir, target))) ||
      filters.some(
        filter =>
          ANGULAR_PACKAGES.has(filter) ||
          (/^\.{0,2}\//.test(filter) && isInAngularWorkspace(path.resolve(dir, filter)))
      );
    if (
      targetsAngular ||
      (dirs.length === 0 && filters.length === 0 && isInAngularWorkspace(dir))
    ) {
      return 'vitest';
    }
  }
  return null;
};

/** Returns the reason to block `command`, or null. */
const check = (command, startDir) => {
  const { command: outer, nested } = extractNested(command);
  for (const inner of nested) {
    const reason = check(inner, startDir);
    if (reason) return reason;
  }
  // Follow `cd` / `pushd` within the command so `cd packages/angular && pnpm vitest` is caught.
  let dir = startDir;
  for (const segment of segments(unquote(outer))) {
    const words = segment.trim().split(/\s+/).filter(Boolean);
    if ((words[0] === 'cd' || words[0] === 'pushd') && words[1] && words[1] !== '-') {
      dir = path.resolve(dir, words[1].replace(/^~(?=\/|$)/, process.env.HOME ?? '~'));
      continue;
    }
    const reason = classify(words, dir);
    if (reason) return reason;
  }
  return null;
};

const block = message => {
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
};

let raw = '';
process.stdin.on('data', chunk => {
  raw += chunk;
});
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    block(`block-raw-tooling: unreadable hook payload (${error.message}); blocking to be safe.`);
    return;
  }
  const command = payload?.tool_input?.command;
  if (typeof command !== 'string') {
    block(
      'block-raw-tooling: the payload has no tool_input.command; the hook schema may have changed.'
    );
    return;
  }
  const reason = check(command, typeof payload.cwd === 'string' ? payload.cwd : process.cwd());
  if (reason) block(MESSAGES[reason]);
});

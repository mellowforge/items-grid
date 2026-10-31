#!/usr/bin/env node
/**
 * PreToolUse hook for Bash.
 *
 * Blocks three kinds of command that are wrong in this repository:
 *   - npm / yarn dependency commands: this is a pnpm workspace (`workspace:` protocol,
 *     `pnpm-lock.yaml`); npm would write a stray package-lock.json and break the links.
 *   - publishing: releases go through Changesets in CI (`.claude/rules/release.md`). An agent
 *     never runs `npm publish`, `pnpm publish`, `changeset publish` or `pnpm release`.
 *   - `vitest` inside the Angular workspace (`packages/angular`): its specs need the TestBed
 *     environment that only `ng test` (`@angular/build:unit-test`) builds. In `packages/core`
 *     and `packages/react`, `pnpm exec vitest run <file>` is the documented single-file command.
 *
 * Exit codes:
 *   0 — allow
 *   2 — block (stderr is shown to the agent as the reason)
 */

const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const MESSAGES = {
  install:
    'This is a pnpm workspace. Use `pnpm install` / `pnpm add <pkg> --filter <package>` instead of npm or yarn.',
  publish:
    'Publishing is blocked for agents. Releases go through Changesets: add a changeset with `pnpm changeset`, and CI publishes when the release PR merges (see .claude/rules/release.md).',
  vitest:
    'Direct `vitest` is blocked in the Angular workspace. Use `pnpm ng test --watch=false --include <spec>` from packages/angular (see CLAUDE.md, Commands).',
};

// Prose never runs: drop heredoc bodies and quoted strings before looking for commands, so a
// commit message like "docs: explain npm publish" or Markdown written through a heredoc is ignored.
const stripProse = command =>
  command
    .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2[ \t]*(?=\n|$)/g, '')
    .replace(/'[^']*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');

// One simple command per segment: split on `;`, `&&`, `||`, `|`, `&`, newlines and subshells.
const segments = command => command.split(/\|\||&&|[;|&\n()`]|\$\(/);

// Leading noise that still executes the tool: env assignments and wrapper commands.
const PREFIX = /^\s*(?:(?:\w+=\S*|time|command|exec|env|nohup)\s+)*/;
// Package runners that resolve a binary (`npx -y`, `npm exec --`, `pnpm exec`, `pnpm dlx`).
const RUNNER =
  /^(?:(?:npx|bunx)(?:\s+-\S+)*\s+|npm\s+(?:exec|x)(?:\s+-\S+)*\s+(?:--\s+)?|pnpm\s+(?:(?:-\S+|--filter\s+\S+)\s+)*(?:exec\s+|dlx\s+)?|yarn\s+(?:dlx\s+)?)?/;

const classify = segment => {
  const command = segment.replace(PREFIX, '');
  if (/^npm\s+(?:install|i|ci|add|uninstall|remove|rm|update|up)(?=\s|$)/.test(command)) {
    return 'install';
  }
  if (/^yarn(?:\s+(?:install|add|remove|up|upgrade))?(?=\s|$)/.test(command)) {
    return 'install';
  }
  if (/^(?:npm|pnpm)\s+(?:(?:-\S+|--filter\s+\S+)\s+)*publish(?=\s|$)/.test(command)) {
    return 'publish';
  }
  if (/^pnpm\s+(?:(?:-\S+|--filter\s+\S+)\s+)*(?:run\s+)?release(?=\s|$)/.test(command)) {
    return 'publish';
  }
  const binary = command.replace(RUNNER, '');
  if (/^(?:\S*\/)?changeset\s+publish(?=\s|$)/.test(binary)) {
    return 'publish';
  }
  if (/^(?:\S*\/)?vitest(?:@\S*)?(?=\s|$)/.test(binary)) {
    return 'vitest';
  }
  return null;
};

const isInAngularWorkspace = dir =>
  path.relative(path.join(ROOT, 'packages', 'angular'), dir).split(path.sep)[0] !== '..';

let raw = '';
process.stdin.on('data', chunk => {
  raw += chunk;
});
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    process.exit(0);
  }
  const command = payload?.tool_input?.command;
  if (typeof command !== 'string' || command.length === 0) {
    process.exit(0);
  }

  // Follow `cd` within the command so `cd packages/angular && pnpm vitest` is caught too.
  let dir = typeof payload.cwd === 'string' ? payload.cwd : process.cwd();
  for (const segment of segments(stripProse(command))) {
    const cd = /^\s*cd\s+(\S+)\s*$/.exec(segment);
    if (cd) {
      dir = path.resolve(dir, cd[1].replace(/^~(?=\/|$)/, process.env.HOME ?? '~'));
      continue;
    }
    const kind = classify(segment);
    if (kind === 'vitest' && !isInAngularWorkspace(dir)) {
      continue;
    }
    if (kind) {
      process.stderr.write(`${MESSAGES[kind]}\n`);
      process.exit(2);
    }
  }

  process.exit(0);
});

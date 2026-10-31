// Run with `pnpm test:hooks` (node --test). CI runs it too.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const HOOK = path.join(__dirname, 'block-raw-tooling.js');

/** `input` is a command, or `{ raw }` for a payload sent as is. */
const run = (input, cwd = ROOT) => {
  const payload =
    typeof input === 'string' ? JSON.stringify({ tool_input: { command: input }, cwd }) : input.raw;
  const result = spawnSync(process.execPath, [HOOK], { input: payload, encoding: 'utf8' });
  return { status: result.status, stderr: result.stderr };
};

const expectBlocked = (command, reason, cwd) => {
  const { status, stderr } = run(command, cwd);
  assert.equal(status, 2, `expected a block: ${command}`);
  assert.match(stderr, reason, `wrong reason for: ${command}`);
};

const expectAllowed = (command, cwd) => {
  const { status, stderr } = run(command, cwd);
  assert.equal(status, 0, `expected allowed: ${command}\n${stderr}`);
};

const PUBLISH = /Publishing is blocked/;
const TAGS = /Pushing tags is blocked/;
const INSTALL = /pnpm workspace/;
const VITEST = /Direct `vitest` is blocked/;

describe('block-raw-tooling: publishing', () => {
  for (const command of [
    'npm publish',
    'npm pub',
    'npm unpublish @mellowforge/items-grid-core@0.1.0',
    'npm dist-tag add @mellowforge/items-grid-core@0.1.0 latest',
    'pnpm publish',
    'pnpm -r publish',
    'pnpm --filter x publish',
    'pnpm -F @mellowforge/items-grid-core publish',
    'pnpm -C packages/core publish',
    'pnpm --dir packages/core publish',
    'npm -w x publish',
    'npm --workspace x publish',
    'npm --prefix packages/core publish',
    'npm publish --access public',
    'pnpm release',
    'pnpm run release',
    'pnpm run-script release',
    'npm run release',
    'npm run-script release',
    'yarn release',
    'changeset publish',
    'npx changeset publish',
    'npx --yes changeset@latest publish',
    'npx @changesets/cli publish',
    'pnpm changeset publish',
    'pnpm exec changeset publish',
    'pnpm exec -- changeset publish',
    'pnpm --filter x exec changeset publish',
    'pnpm run changeset publish',
    'npm run changeset -- publish',
    'pnpm dlx @changesets/cli publish',
    'pnpm exec npm publish',
    'pnpm -r exec npm publish',
    'npx npm publish',
    'node node_modules/@changesets/cli/bin.js publish',
    './node_modules/.bin/changeset publish',
    '/usr/local/bin/npm publish',
    'sudo npm publish',
    'timeout 60 npm publish',
    'nice -n 5 npm publish',
    'env -i PATH=/usr/bin npm publish',
    'NPM_TOKEN=x npm publish',
    'corepack pnpm publish',
    'xargs npm publish',
    'command npm publish',
    'pnpm build && pnpm changeset publish',
    'pnpm build; npm publish',
    'true || npm publish',
    'if true; then npm publish; fi',
    '{ npm publish; }',
    '(cd packages/core && npm publish)',
    'echo $(npm publish)',
    'bash -c "npm publish"',
    "sh -c 'pnpm publish'",
    "zsh -lc 'cd packages/core && npm publish'",
    'eval "npm publish"',
  ]) {
    it(`blocks ${command}`, () => expectBlocked(command, PUBLISH));
  }
});

describe('block-raw-tooling: tags', () => {
  for (const command of [
    'git push --tags',
    'git push origin --tags',
    'git push --follow-tags',
    'git push origin refs/tags/v1.0.0',
    'git push origin @mellowforge/items-grid-core@0.1.0',
    'git push origin v1.0.0',
    'pnpm changeset tag',
    'npx changeset tag',
  ]) {
    it(`blocks ${command}`, () => expectBlocked(command, TAGS));
  }
});

describe('block-raw-tooling: package managers', () => {
  for (const command of [
    'npm install',
    'npm i lodash',
    'npm ci',
    'npm uninstall x',
    'npm update',
  ]) {
    it(`blocks ${command}`, () => expectBlocked(command, INSTALL));
  }
  for (const command of ['yarn', 'yarn install', 'yarn add x', 'yarn test']) {
    it(`blocks ${command}`, () => expectBlocked(command, INSTALL));
  }
});

describe('block-raw-tooling: vitest in the Angular workspace', () => {
  const angular = path.join(ROOT, 'packages', 'angular');
  for (const command of [
    'vitest run',
    'pnpm vitest run',
    'pnpm exec vitest run',
    'npx vitest run',
    'pnpm dlx vitest run',
  ]) {
    it(`blocks ${command} inside packages/angular`, () => expectBlocked(command, VITEST, angular));
  }
  for (const command of [
    'cd packages/angular && pnpm exec vitest run',
    'cd "packages/angular" && pnpm exec vitest run',
    'pushd packages/angular && pnpm exec vitest run',
    'pnpm -C packages/angular exec vitest run',
    'pnpm --dir packages/angular exec vitest run',
    'pnpm --filter items-grid-angular-workspace exec vitest run',
    'pnpm -F ./packages/angular exec vitest run',
  ]) {
    it(`blocks ${command} from the root`, () => expectBlocked(command, VITEST));
  }
});

describe('block-raw-tooling: allowed', () => {
  for (const command of [
    'pnpm build',
    'pnpm test',
    'pnpm lint',
    'pnpm typecheck',
    'pnpm format:check',
    'pnpm pack:check',
    'pnpm install',
    'pnpm install --frozen-lockfile',
    'pnpm add -D x --filter items-grid-angular-workspace',
    'pnpm changeset',
    'pnpm changeset status --verbose',
    'pnpm version-packages',
    'pnpm test:hooks',
    "pnpm --filter @mellowforge/items-grid-core exec vitest run src/controller.spec.ts -t 'name'",
    'pnpm --filter @mellowforge/items-grid-react exec vitest run',
    'cd packages/angular && pnpm ng test --watch=false',
    'cd packages/angular && pnpm ng test --watch=false --include lib/items-grid.spec.ts',
    'npm view @mellowforge/items-grid-core version',
    'npm pack --dry-run',
    'npm --version',
    'git commit -m "docs: explain npm publish and pnpm release"',
    "git commit -m 'chore: yarn and npm install notes'",
    'git push -u origin main',
    'git push origin feat/release-notes',
    'git tag --list',
    'git log --oneline',
    'echo publish',
    "cat <<'EOF'\nnpm publish\nEOF",
    'grep -rn "npm publish" .claude',
    '',
  ]) {
    it(`allows ${JSON.stringify(command)}`, () => expectAllowed(command));
  }
  it('allows vitest in core', () =>
    expectAllowed('pnpm exec vitest run', path.join(ROOT, 'packages', 'core')));
});

describe('block-raw-tooling: fails closed', () => {
  it('blocks an unreadable payload', () => {
    const { status, stderr } = run({ raw: '{not json' });
    assert.equal(status, 2);
    assert.match(stderr, /unreadable hook payload/);
  });
  it('blocks a payload without tool_input.command', () => {
    const { status, stderr } = run({ raw: JSON.stringify({ tool_input: { cmd: 'npm publish' } }) });
    assert.equal(status, 2);
    assert.match(stderr, /no tool_input\.command/);
  });
});

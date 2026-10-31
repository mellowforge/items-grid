import { describe, expect, it } from 'vitest';

import readme from '../../../README.md?raw';
import angular from './examples/angular.example.ts?raw';
import react from './examples/react.example.tsx?raw';
import vanilla from './examples/vanilla.example.ts?raw';

/** The first fenced code block of `language` after the README heading `heading`. */
function quickStart(heading: string, language: string): string {
  const section = readme.slice(readme.indexOf(heading));
  const match = new RegExp('```' + language + '\\n([\\s\\S]*?)```').exec(section);
  if (!match) throw new Error(`no ${language} block under ${heading}`);
  return match[1]!;
}

// The landing page shows src/examples verbatim; the root README shows the same code.
describe('quick-start examples', () => {
  it.each([
    ['### React', 'tsx', react],
    ['### Angular', 'ts', angular],
    ['### Any framework, or none', 'ts', vanilla],
  ])('%s in the README matches the site', (heading, language, example) => {
    expect(quickStart(heading, language).trim()).toBe(example.trim());
  });
});

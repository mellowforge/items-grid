// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyTheme, currentTheme, restoreTheme } from './theme';

const prefersDark = (dark: boolean): void => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: dark && query.includes('dark') }));
};

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  vi.unstubAllGlobals();
});

describe('theme', () => {
  it('follows the OS until a choice is made, without setting data-theme', () => {
    prefersDark(true);
    restoreTheme();
    expect(currentTheme()).toBe('dark');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('applies and remembers an explicit choice, and restores it on the next page', () => {
    prefersDark(true);
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    document.documentElement.removeAttribute('data-theme');
    restoreTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(currentTheme()).toBe('light');
  });

  it('still switches when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

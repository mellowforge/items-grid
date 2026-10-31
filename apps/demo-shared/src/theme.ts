export type Theme = 'light' | 'dark';

/** Shared by the landing page and the demos — one origin, so one choice carries over. */
const STORAGE_KEY = 'items-grid-demo-theme';

function storedTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    // Storage can throw in private modes or with site data blocked.
    return null;
  }
}

/** The theme the page shows right now: the stored choice, else the OS preference. */
export function currentTheme(): Theme {
  return (
    storedTheme() ??
    (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light')
  );
}

/**
 * Restores a stored choice onto `<html data-theme>` at startup. Without one the attribute
 * stays unset, so `demo.css` keeps following the OS live.
 */
export function restoreTheme(): void {
  const stored = storedTheme();
  if (stored) document.documentElement.setAttribute('data-theme', stored);
}

/** Applies an explicit choice from a toggle, and remembers it. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not remembered; the toggle still works for this page view.
  }
}

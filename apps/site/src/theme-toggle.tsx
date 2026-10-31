import { applyTheme, currentTheme, restoreTheme, type Theme } from 'demo-shared';
import { type ReactElement, useLayoutEffect, useState } from 'react';

/** Light/dark switch. Follows the OS until clicked; the choice carries over to the demos. */
export function ThemeToggle(): ReactElement {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  useLayoutEffect(() => {
    restoreTheme();
  }, []);

  const toggle = (): void => {
    applyTheme(next);
    setTheme(next);
  };

  return (
    <button
      type="button"
      className="ghost theme-toggle"
      aria-label={`Switch to ${next} theme`}
      onClick={toggle}
    >
      <span aria-hidden="true">{next === 'dark' ? '☾' : '☀'}</span>
      {next === 'dark' ? 'Dark' : 'Light'}
    </button>
  );
}

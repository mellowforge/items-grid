import { describe, expect, it } from 'vitest';

import css from './items-grid.css?raw';

/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(selector: string): string {
  const match = new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[2]!;
}

describe('items-grid.css (optional pager theme)', () => {
  // The page size depends on the pager's height (it sits below the measured viewport), and
  // the pager's width depends on the page size (status text, number of pages). A pager that
  // wraps closes that loop: at some widths the grid flips between two page sizes every frame.
  it('keeps the pager on one line, whatever its content', () => {
    for (const selector of ['.mf-items-grid-pager', '.mf-items-grid-pager__list']) {
      expect(rule(selector)).not.toMatch(/flex-wrap:\s*wrap/);
    }
    expect(rule('.mf-items-grid-pager__status')).toMatch(/white-space:\s*nowrap/);
    expect(rule('.mf-items-grid-pager__list')).toMatch(/flex:\s*none/);
  });

  it('truncates the status instead of growing the pager', () => {
    const status = rule('.mf-items-grid-pager__status');
    expect(status).toMatch(/min-width:\s*0/);
    expect(status).toMatch(/text-overflow:\s*ellipsis/);
  });
});

import { describe, expect, it } from 'vitest';

import { DEFAULT_PAGER_LABELS, resolvePagerLabels } from './pager';

describe('DEFAULT_PAGER_LABELS', () => {
  it('shows the range and total', () => {
    expect(DEFAULT_PAGER_LABELS.status({ start: 12, end: 24 }, 57, true)).toBe('Items 13–24 of 57');
  });

  it('omits the total while it is unknown', () => {
    expect(DEFAULT_PAGER_LABELS.status({ start: 12, end: 24 }, 24, false)).toBe('Items 13–24');
  });

  it('says so when there is nothing to show', () => {
    expect(DEFAULT_PAGER_LABELS.status({ start: 0, end: 0 }, 0, true)).toBe('No items');
  });

  it('is frozen, so one app cannot change every grid', () => {
    expect(Object.isFrozen(DEFAULT_PAGER_LABELS)).toBe(true);
  });
});

describe('resolvePagerLabels', () => {
  it('merges overrides and ignores explicit undefined', () => {
    const labels = resolvePagerLabels({ next: 'Weiter', page: undefined });
    expect(labels.next).toBe('Weiter');
    expect(labels.page(2)).toBe('Page 3');
  });
});

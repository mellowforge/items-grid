import { describe, expect, it } from 'vitest';

import { countPending, createSnapshot, resolveFrozenPage } from './freeze';

interface Item {
  id: string;
  status: string;
}

const getKey = (item: Item): string => item.id;
const make = (...ids: string[]): Item[] => ids.map(id => ({ id, status: 'ok' }));

describe('stable-mode freeze', () => {
  const items = make('a', 'b', 'c', 'd', 'e', 'f');
  const snapshot = createSnapshot(items, getKey, { start: 2, end: 4 });

  it('records the keys of the current page', () => {
    expect(snapshot.pageKeys).toEqual(['c', 'd']);
  });

  it('keeps the frozen page when items are inserted before it', () => {
    const next = [...make('x', 'y'), ...items];
    expect(resolveFrozenPage(snapshot, next, getKey).map(getKey)).toEqual(['c', 'd']);
  });

  it('keeps the frozen page when items are inserted on and after it', () => {
    const next = [...make('a', 'b', 'c'), ...make('new'), ...make('d', 'e', 'f', 'z')];
    expect(resolveFrozenPage(snapshot, next, getKey).map(getKey)).toEqual(['c', 'd']);
  });

  it('renders the latest object for a frozen key so status updates still arrive', () => {
    const updated = items.map(item => (item.id === 'd' ? { ...item, status: 'error' } : item));
    expect(resolveFrozenPage(snapshot, updated, getKey)[1]).toEqual({ id: 'd', status: 'error' });
  });

  it('drops a removed key and leaves the page short instead of pulling in a replacement', () => {
    const next = items.filter(item => item.id !== 'c');
    expect(resolveFrozenPage(snapshot, next, getKey).map(getKey)).toEqual(['d']);
  });

  it('counts keys that were not in the dataset when the freeze started', () => {
    const next = [...make('x'), ...items, ...make('y', 'z')];
    expect(countPending(snapshot, next, getKey)).toBe(3);
  });

  it('does not count removals as pending', () => {
    expect(countPending(snapshot, items.slice(0, 3), getKey)).toBe(0);
  });
});

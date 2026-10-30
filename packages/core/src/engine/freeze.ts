import type { ItemKey, ItemRange } from './types';

/** What a stable (frozen) page remembers from the moment it was frozen. */
export interface FreezeSnapshot {
  /** Keys of the cards on the frozen page, in order. */
  readonly pageKeys: readonly ItemKey[];
  /** Every key in the dataset at freeze time; anything else counts as new. */
  readonly knownKeys: ReadonlySet<ItemKey>;
}

/** Freezes the cards in `range` of `items`. */
export function createSnapshot<T>(
  items: readonly T[],
  getKey: (item: T) => ItemKey,
  range: ItemRange
): FreezeSnapshot {
  const knownKeys = new Set<ItemKey>();
  const pageKeys: ItemKey[] = [];
  items.forEach((item, index) => {
    const key = getKey(item);
    knownKeys.add(key);
    if (index >= range.start && index < range.end) {
      pageKeys.push(key);
    }
  });
  return { pageKeys, knownKeys };
}

/**
 * The frozen page's cards, resolved to the latest item object for each key so updates
 * still render. A removed key drops out and leaves the page short.
 */
export function resolveFrozenPage<T>(
  snapshot: FreezeSnapshot,
  items: readonly T[],
  getKey: (item: T) => ItemKey
): T[] {
  const wanted = new Set(snapshot.pageKeys);
  const byKey = new Map<ItemKey, T>();
  items.forEach(item => {
    const key = getKey(item);
    if (wanted.has(key)) {
      byKey.set(key, item);
    }
  });
  const page: T[] = [];
  for (const key of snapshot.pageKeys) {
    const item = byKey.get(key);
    if (item !== undefined) {
      page.push(item);
    }
  }
  return page;
}

/** Number of items whose keys were not in the dataset when the page was frozen. */
export function countPending<T>(
  snapshot: FreezeSnapshot,
  items: readonly T[],
  getKey: (item: T) => ItemKey
): number {
  let pending = 0;
  items.forEach(item => {
    if (!snapshot.knownKeys.has(getKey(item))) {
      pending++;
    }
  });
  return pending;
}

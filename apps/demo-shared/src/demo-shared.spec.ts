import { describe, expect, it, vi } from 'vitest';

import { cardView } from './card';
import { createEntities, createRandom } from './entities';
import { fetchPage } from './server';
import { tick } from './simulation';

describe('demo fixtures', () => {
  it('creates the same dataset for every demo', () => {
    expect(createEntities(8)).toEqual(createEntities(8));
    expect(new Set(createEntities(120).map(entity => entity.id)).size).toBe(120);
  });

  it('never mutates the dataset during a tick', () => {
    const entities = createEntities(20);
    const frozen = Object.freeze([...entities]);
    const random = createRandom(1);
    let serial = 1000;
    for (let step = 0; step < 50; step++) {
      expect(() => tick(frozen, random, () => serial++)).not.toThrow();
    }
  });

  it('serves pages after a delay', async () => {
    vi.useFakeTimers();
    const promise = fetchPage(createEntities(30), { pageIndex: 2, pageSize: 12 }, 100);
    vi.advanceTimersByTime(100);
    const page = await promise;
    expect(page.items).toHaveLength(6);
    expect(page.total).toBe(30);
    vi.useRealTimers();
  });

  it('shows the Figma card content per size', () => {
    const [device, , job] = createEntities(3);
    expect(cardView(device!, 'compact')).toMatchObject({ showSummary: true, details: [] });
    expect(cardView(device!, 'normal').details).toHaveLength(2);
    expect(cardView(job!, 'normal')).toMatchObject({ showProgress: true });
    expect(cardView(job!, 'normal').details).toHaveLength(1);
    expect(cardView(device!, 'large')).toMatchObject({ showActions: true });
  });
});

// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ItemsGrid } from './items-grid';

// React 18 warns for every useLayoutEffect rendered on the server (React 19 is silent), so
// the adapter must not call it there. Counting calls proves it under either version.
const layoutEffects = vi.hoisted(() => ({ calls: 0 }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useLayoutEffect: (...args: Parameters<typeof actual.useLayoutEffect>) => {
      layoutEffects.calls++;
      return actual.useLayoutEffect(...args);
    },
  };
});

describe('server rendering', () => {
  it('renders the grid without layout effects', () => {
    expect(typeof window).toBe('undefined');
    const html = renderToString(
      <ItemsGrid
        items={[{ id: 1 }, { id: 2 }]}
        getKey={item => item.id}
        renderItem={item => <span>Entity {item.id}</span>}
      />
    );
    expect(html).toContain('mf-items-grid__viewport');
    expect(layoutEffects.calls).toBe(0);
  });
});

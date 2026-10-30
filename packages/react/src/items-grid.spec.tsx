import type { ItemsGridController, PageRequest } from '@quietfoundry/items-grid-core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef, type Ref, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ItemsGrid, type ItemsGridProps } from './items-grid';
import { flushFrames, installLayoutStubs, ResizeObserverStub } from './test-utils/resize-observer';

interface Entity {
  id: number;
  name: string;
}

const entities = (count: number): Entity[] =>
  Array.from({ length: count }, (_, id) => ({ id, name: `Entity ${id}` }));

// React 19 passes `ref` to function components as a prop; the wrapper forwards it.
function Grid(props: Partial<ItemsGridProps<Entity>> & { ref?: Ref<ItemsGridController<Entity>> }) {
  return (
    <div style={{ height: 600 }}>
      <ItemsGrid<Entity>
        items={entities(30)}
        getKey={item => item.id}
        renderItem={item => <article>{item.name}</article>}
        aria-label="Entities"
        {...props}
      />
    </div>
  );
}

const viewport = (): HTMLElement => screen.getByRole('list', { name: 'Entities' });
const cards = (): string[] => screen.queryAllByRole('listitem').map(item => item.textContent ?? '');

/** Normal preset: 1318×552 → 4 × 3 = 12 per page; 976×552 → 3 × 3 = 9. */
function layout(width = 1318, height = 552): void {
  act(() => {
    ResizeObserverStub.for(viewport()).fire(width, height);
    flushFrames();
  });
}

beforeEach(() => {
  installLayoutStubs();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ItemsGrid', () => {
  it('renders exactly one page of cards once the viewport is measured', () => {
    render(<Grid />);
    expect(cards()).toHaveLength(0);
    layout();
    expect(cards()).toHaveLength(12);
    expect(cards()[0]).toBe('Entity 0');
  });

  it('re-renders on its own when the viewport resizes outside React (blank-render guard)', async () => {
    render(<Grid />);
    ResizeObserverStub.for(viewport()).fire(1318, 552);
    flushFrames();
    expect(await screen.findAllByRole('listitem')).toHaveLength(12);
  });

  it('applies the geometry as inline grid styles', () => {
    render(<Grid />);
    layout();
    expect(viewport().style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
    expect(viewport().style.gridAutoRows).toBe('160px');
  });

  it('pages with the pager buttons', () => {
    render(<Grid />);
    layout();
    expect(screen.getByRole('button', { name: 'Previous page' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Page 1' }).getAttribute('aria-current')).toBe(
      'page'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(cards()[0]).toBe('Entity 12');
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(cards()).toHaveLength(6);
    expect(screen.getByText('Items 25–30 of 30')).toBeTruthy();
  });

  it('pages with PageDown inside the grid', () => {
    render(<Grid />);
    layout();
    const handled = !fireEvent.keyDown(screen.getAllByRole('listitem')[0]!, { key: 'PageDown' });
    expect(handled).toBe(true);
    expect(cards()[0]).toBe('Entity 12');
  });

  it('keeps the first card on screen when the page shrinks', () => {
    render(<Grid />);
    layout();
    fireEvent.click(screen.getByRole('button', { name: 'Page 2' })); // items 12–23
    layout(976, 552); // 9 per page → page 2 shows 9–17
    expect(cards()).toContain('Entity 12');
  });

  it('keeps card DOM nodes when items are replaced with updated objects', () => {
    const { rerender } = render(<Grid />);
    layout();
    const first = screen.getAllByRole('listitem')[0];
    rerender(<Grid items={entities(30).map(item => ({ ...item, name: `${item.name}!` }))} />);
    expect(screen.getAllByRole('listitem')[0]).toBe(first);
    expect(cards()[0]).toBe('Entity 0!');
  });

  it('renders one skeleton per slot while loading', () => {
    render(
      <Grid
        mode="server"
        items={[]}
        loading
        renderSkeleton={() => <div data-testid="skeleton" />}
      />
    );
    layout();
    expect(screen.getAllByTestId('skeleton')).toHaveLength(12);
    expect(viewport().getAttribute('aria-busy')).toBe('true');
  });

  it('renders the empty template when there are no items', () => {
    render(<Grid items={[]} renderEmpty={() => <p>No entities yet</p>} />);
    layout();
    expect(screen.getByText('No entities yet')).toBeTruthy();
  });

  it('measures the row height from a hidden probe card', () => {
    const { container } = render(<Grid measureRowHeight />);
    layout();
    const probe = container.querySelector<HTMLElement>('.qf-items-grid__probe')!;
    expect(probe.getAttribute('aria-hidden')).toBe('true');
    act(() => {
      ResizeObserverStub.for(probe).fire(280, 118, { inlineSize: 280, blockSize: 118 });
      flushFrames();
    });
    expect(viewport().style.gridAutoRows).toBe('118px');
  });

  it('requests pages in server mode, ignoring new callback identities on re-render', () => {
    const requests: PageRequest[] = [];
    const { rerender } = render(
      <Grid mode="server" items={[]} onPageRequest={request => requests.push(request)} />
    );
    layout();
    rerender(<Grid mode="server" items={[]} onPageRequest={request => requests.push(request)} />);
    expect(requests).toEqual([{ pageIndex: 0, pageSize: 12 }]);
  });

  it('starts at the pageIndex prop and follows later changes to it', () => {
    const { rerender } = render(<Grid pageIndex={1} />);
    layout();
    expect(cards()[0]).toBe('Entity 12');
    rerender(<Grid pageIndex={2} />);
    expect(cards()[0]).toBe('Entity 24');
  });

  it('reports state changes to app chrome outside the grid', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(<Grid onStateChange={first} />);
    rerender(<Grid onStateChange={latest} />);
    layout();
    expect(latest).toHaveBeenLastCalledWith(expect.objectContaining({ pageSize: 12 }));
    expect(first).not.toHaveBeenCalled();
  });

  it('reports page changes', () => {
    const onPageChange = vi.fn();
    render(<Grid onPageChange={onPageChange} />);
    layout();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('announces page changes in a polite live region', () => {
    const { container } = render(<Grid />);
    layout();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(container.querySelector('[aria-live="polite"]')!.textContent).toBe(
      'Page 2 of 3, items 13–24 of 30'
    );
  });

  it('exposes the controller through a ref', () => {
    const ref = createRef<ItemsGridController<Entity>>();
    render(<Grid ref={ref} />);
    layout();
    act(() => ref.current!.goTo(2));
    expect(cards()[0]).toBe('Entity 24');
  });

  it('renders a custom pager and none when pager is false', () => {
    const { rerender } = render(
      <Grid pager={({ state }) => <p>custom {state.pageIndex + 1}</p>} />
    );
    layout();
    expect(screen.getByText('custom 1')).toBeTruthy();
    rerender(<Grid pager={false} />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('survives StrictMode: one live observer while mounted, none after unmount', () => {
    const { unmount } = render(
      <StrictMode>
        <Grid />
      </StrictMode>
    );
    layout();
    expect(cards()).toHaveLength(12);
    const live = () =>
      ResizeObserverStub.instances.filter(
        observer => !observer.disconnected && observer.observed.includes(viewport())
      );
    expect(live()).toHaveLength(1);
    const element = viewport();
    unmount();
    expect(
      ResizeObserverStub.instances.filter(
        observer => !observer.disconnected && observer.observed.includes(element)
      )
    ).toHaveLength(0);
  });

  it('works in StrictMode after the remount (state still updates)', () => {
    render(
      <StrictMode>
        <Grid />
      </StrictMode>
    );
    layout();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(cards()[0]).toBe('Entity 12');
  });
});

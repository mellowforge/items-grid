import type { ItemsGridHandle, PageRequest } from '@mellowforge/items-grid-core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Component, createRef, type ReactNode, type Ref, StrictMode } from 'react';
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
function Grid(props: Partial<ItemsGridProps<Entity>> & { ref?: Ref<ItemsGridHandle<Entity>> }) {
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

const viewport = (): HTMLElement => document.querySelector('.qf-items-grid__viewport')!;
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

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override render() {
    return this.state.error ? <p role="alert">{this.state.error.message}</p> : this.props.children;
  }
}

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

  it('renders the empty template, and is not a list while empty', () => {
    render(<Grid items={[]} renderEmpty={() => <p>No entities yet</p>} />);
    layout();
    expect(screen.getByText('No entities yet')).toBeTruthy();
    expect(viewport().hasAttribute('role')).toBe(false);
  });

  it('measures the row height from a hidden probe card', () => {
    const { container } = render(<Grid measureRowHeight />);
    layout();
    const probe = container.querySelector<HTMLElement>('.qf-items-grid__probe')!;
    expect(probe.getAttribute('aria-hidden')).toBe('true');
    act(() => {
      ResizeObserverStub.for(probe).fire(280, 100, { inlineSize: 280, blockSize: 118 });
      flushFrames();
    });
    expect(viewport().style.gridAutoRows).toBe('118px');
  });

  it('requests pages in server mode through the latest callback, without re-syncing', () => {
    const first: PageRequest[] = [];
    const latest: PageRequest[] = [];
    const items = entities(12);
    const { rerender } = render(
      <Grid mode="server" items={items} total={30} onPageRequest={request => first.push(request)} />
    );
    layout();
    rerender(
      <Grid
        mode="server"
        items={items}
        total={30}
        onPageRequest={request => latest.push(request)}
      />
    );
    expect(first).toEqual([{ pageIndex: 0, pageSize: 12 }]);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(latest).toEqual([{ pageIndex: 1, pageSize: 12 }]);
    expect(first).toHaveLength(1);
  });

  it('keeps the first card on screen and reports the page when the preset changes', () => {
    const onPageChange = vi.fn();
    const { rerender } = render(<Grid onPageChange={onPageChange} />);
    layout();
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' })); // items 24–29
    rerender(<Grid onPageChange={onPageChange} preset="large" />); // 3 × 2 = 6 per page
    expect(cards()).toContain('Entity 24');
    expect(onPageChange).toHaveBeenLastCalledWith(4);
  });

  it('pages back with PageUp and leaves other keys alone', () => {
    render(<Grid />);
    layout();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(!fireEvent.keyDown(screen.getAllByRole('listitem')[0]!, { key: 'ArrowDown' })).toBe(
      false
    );
    fireEvent.keyDown(screen.getAllByRole('listitem')[0]!, { key: 'PageUp' });
    expect(cards()[0]).toBe('Entity 0');
  });

  it('ignores PageDown typed into a field inside a card', () => {
    render(
      <Grid
        renderItem={item => (
          <article>
            {item.name}
            <input aria-label={`Note for ${item.name}`} />
          </article>
        )}
      />
    );
    layout();
    const handled = !fireEvent.keyDown(screen.getByLabelText('Note for Entity 0'), {
      key: 'PageDown',
    });
    expect(handled).toBe(false);
    expect(cards()[0]).toBe('Entity 0');
  });

  it('swaps skeletons for cards when loading ends', () => {
    const { rerender } = render(
      <Grid
        mode="server"
        items={[]}
        loading
        renderSkeleton={() => <div data-testid="skeleton" />}
      />
    );
    layout();
    rerender(
      <Grid
        mode="server"
        items={entities(12)}
        total={30}
        renderSkeleton={() => <div data-testid="skeleton" />}
      />
    );
    expect(screen.queryAllByTestId('skeleton')).toHaveLength(0);
    expect(cards()).toHaveLength(12);
    expect(viewport().hasAttribute('aria-busy')).toBe(false);
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
    const ref = createRef<ItemsGridHandle<Entity>>();
    render(<Grid ref={ref} />);
    layout();
    act(() => ref.current!.goTo(2));
    expect(cards()[0]).toBe('Entity 24');
  });

  it('renders a custom pager and none when pager is false', () => {
    const { rerender } = render(
      <Grid
        pager={({ state, controller }) => (
          <button type="button" onClick={controller.next}>
            custom {state.pageIndex + 1}
          </button>
        )}
      />
    );
    layout();
    fireEvent.click(screen.getByText('custom 1'));
    expect(screen.getByText('custom 2')).toBeTruthy();
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

  it('keeps exactly one live probe observer in StrictMode', () => {
    const { container, unmount } = render(
      <StrictMode>
        <Grid measureRowHeight />
      </StrictMode>
    );
    layout();
    const probe = container.querySelector('.qf-items-grid__probe')!;
    const live = () =>
      ResizeObserverStub.instances.filter(
        observer => !observer.disconnected && observer.observed.includes(probe)
      );
    expect(live()).toHaveLength(1);
    unmount();
    expect(live()).toHaveLength(0);
  });

  it('surfaces invalid options as an error', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <Boundary>
        <Grid />
      </Boundary>
    );
    layout();
    rerender(
      <Boundary>
        <Grid preset="huge" />
      </Boundary>
    );
    expect(screen.getByRole('alert').textContent).toContain('items-grid: unknown preset "huge"');
    error.mockRestore();
  });

  it('sends no page request after unmount', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const requests: PageRequest[] = [];
    const { unmount } = render(
      <Grid mode="server" items={[]} onPageRequest={request => requests.push(request)} />
    );
    layout();
    layout(976, 552);
    unmount();
    vi.advanceTimersByTime(500);
    vi.useRealTimers();
    expect(requests).toHaveLength(1);
  });

  it('pages on while the server total is unknown and pages come back full', () => {
    const requests: PageRequest[] = [];
    render(
      <Grid mode="server" items={entities(12)} onPageRequest={request => requests.push(request)} />
    );
    layout();
    expect(screen.getByText('Items 1–12')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Page 2' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(requests.at(-1)).toEqual({ pageIndex: 1, pageSize: 12 });
  });

  it('passes pager labels through, ignoring undefined ones', () => {
    render(<Grid pagerLabels={{ next: 'Weiter', page: undefined }} />);
    layout();
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Page 1' })).toBeTruthy();
  });

  it('reports reanchoring when a hidden grid is shown again', () => {
    const onPageChange = vi.fn();
    render(<Grid items={entities(120)} onPageChange={onPageChange} />);
    layout();
    fireEvent.click(screen.getByRole('button', { name: 'Page 5' })); // index 4, item 48
    layout(0, 0);
    layout(976, 552); // 9 per page → item 48 is on index 5
    expect(onPageChange).toHaveBeenLastCalledWith(5);
  });

  it('does not page when a card already handled the key', () => {
    render(
      <Grid
        renderItem={item => (
          <article onKeyDown={event => event.preventDefault()}>{item.name}</article>
        )}
      />
    );
    layout();
    fireEvent.keyDown(screen.getByText('Entity 0'), { key: 'PageDown' });
    expect(cards()[0]).toBe('Entity 0');
  });

  it('keeps the pager status blank until the grid is measured', () => {
    const { container } = render(<Grid />);
    expect(container.querySelector('.qf-items-grid-pager__status')!.textContent).toBe('');
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

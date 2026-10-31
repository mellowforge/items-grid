import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './app';
import { flushFrames, installLayoutStubs, ResizeObserverStub } from './test-utils/resize-observer';

beforeEach(() => {
  installLayoutStubs();
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  vi.unstubAllGlobals();
});

/** Lays out the hero grid's viewport at a size, as the browser would. */
function layoutHero(width: number, height: number): void {
  const viewport = document.querySelector<HTMLElement>('.hero-frame .mf-items-grid__viewport')!;
  act(() => {
    ResizeObserverStub.for(viewport).fire(width, height);
    flushFrames();
  });
}

describe('landing page', () => {
  it('pitches the library and links to the three demos', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('fit the screen');
    for (const name of [/React demo/, /Angular demo/, /Vanilla demo/]) {
      expect(screen.getAllByRole('link', { name }).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByRole('link', { name: /React demo/ })[0]!.getAttribute('href')).toBe(
      'react/'
    );
  });

  it('shows the live grid and how many cards fit', () => {
    render(<App />);
    // Compact preset (200 px cards, 96 px rows, 8 px gaps): 640 × 360 → 3 × 3.
    layoutHero(640, 360);
    const hero = screen.getByRole('region', { name: 'Live grid' });
    expect(within(hero).getAllByRole('listitem')).toHaveLength(9);
    expect(within(hero).getByText('3 × 3 = 9 per page')).toBeTruthy();
  });

  it('resizes the frame from the keyboard-friendly sliders', () => {
    render(<App />);
    const frame = document.querySelector<HTMLElement>('.hero-frame')!;
    const before = frame.style.height;
    fireEvent.change(screen.getByRole('slider', { name: 'Grid height' }), {
      target: { value: '240' },
    });
    expect(frame.style.height).toBe('240px');
    expect(frame.style.height).not.toBe(before);
    fireEvent.change(screen.getByRole('slider', { name: 'Grid width' }), {
      target: { value: '60' },
    });
    expect(frame.style.width).toBe('60%');
  });

  it('switches the quick-start tabs with the arrow keys', () => {
    render(<App />);
    const react = screen.getByRole('tab', { name: 'React' });
    expect(react.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(react, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Angular' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toContain('@mellowforge/items-grid-angular');
  });

  it('switches and remembers the theme', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeTruthy();
  });
});

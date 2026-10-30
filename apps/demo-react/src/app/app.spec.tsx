import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushFrames, installLayoutStubs, ResizeObserverStub } from '../test-utils/resize-observer';
import { App } from './app';

beforeEach(() => {
  installLayoutStubs();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('demo-react', () => {
  it('renders one page of sample cards once the grid is measured', () => {
    render(<App />);
    act(() => {
      ResizeObserverStub.for(screen.getByRole('list', { name: 'Entities' })).fire(1318, 552);
      flushFrames();
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(12);
    expect(screen.getByText('Items 1–12 of 120')).toBeTruthy();
  });
});

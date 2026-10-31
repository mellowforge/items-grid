// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { observeSize } from './observe';

// The Angular adapter attaches observers in effects, which also run during SSR.
describe('observeSize on the server', () => {
  it('is a silent no-op without window and ResizeObserver', () => {
    expect(typeof window).toBe('undefined');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onSize = vi.fn();
    const stop = observeSize({} as Element, onSize);
    expect(() => stop()).not.toThrow();
    expect(onSize).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

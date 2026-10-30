import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushFrames, installLayoutStubs, ResizeObserverStub } from '../test-utils/resize-observer';
import { observeSize } from './observe';

beforeEach(() => {
  installLayoutStubs();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('observeSize', () => {
  it('reports the content-box size once per animation frame, with the latest value', () => {
    const element = document.createElement('div');
    const onSize = vi.fn();
    observeSize(element, onSize);
    const observer = ResizeObserverStub.instances[0]!;
    expect(observer.observed).toEqual([element]);

    observer.fire(100, 50);
    observer.fire(120, 60);
    expect(onSize).not.toHaveBeenCalled();
    flushFrames();
    expect(onSize).toHaveBeenCalledTimes(1);
    expect(onSize).toHaveBeenCalledWith({ width: 120, height: 60 });
  });

  it('reports the border-box size when asked', () => {
    const onSize = vi.fn();
    observeSize(document.createElement('div'), onSize, { box: 'border' });
    ResizeObserverStub.instances[0]!.fire(100, 50, { inlineSize: 102, blockSize: 52 });
    flushFrames();
    expect(onSize).toHaveBeenCalledWith({ width: 102, height: 52 });
  });

  it('disconnects and drops a pending frame on teardown', () => {
    const onSize = vi.fn();
    const stop = observeSize(document.createElement('div'), onSize);
    const observer = ResizeObserverStub.instances[0]!;
    observer.fire(100, 50);
    stop();
    flushFrames();
    expect(observer.disconnected).toBe(true);
    expect(onSize).not.toHaveBeenCalled();
  });

  it('does nothing where ResizeObserver does not exist (SSR, old browsers)', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const stop = observeSize(document.createElement('div'), vi.fn());
    expect(() => stop()).not.toThrow();
  });
});

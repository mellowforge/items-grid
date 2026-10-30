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
    const observer = ResizeObserverStub.instances[0]!;
    expect(observer.options).toEqual([{ box: 'border-box' }]);
    observer.fire(100, 50, { inlineSize: 102, blockSize: 52 });
    flushFrames();
    expect(onSize).toHaveBeenCalledWith({ width: 102, height: 52 });
  });

  it('cancels only its own frame on teardown', () => {
    const kept = vi.fn();
    observeSize(document.createElement('div'), kept);
    const stop = observeSize(document.createElement('div'), vi.fn());
    ResizeObserverStub.instances[0]!.fire(10, 10);
    ResizeObserverStub.instances[1]!.fire(20, 20);
    stop();
    flushFrames();
    expect(kept).toHaveBeenCalledWith({ width: 10, height: 10 });
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

  it('warns once where ResizeObserver does not exist (SSR, tests without a polyfill)', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stop = observeSize(document.createElement('div'), vi.fn());
    observeSize(document.createElement('div'), vi.fn());
    expect(() => stop()).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('ResizeObserver is unavailable');
    warn.mockRestore();
  });

  it('falls back to the bounding box for the border box where borderBoxSize is missing', () => {
    const element = document.createElement('div');
    element.getBoundingClientRect = () => ({ width: 104, height: 58 }) as DOMRect;
    const onSize = vi.fn();
    observeSize(element, onSize, { box: 'border' });
    ResizeObserverStub.instances[0]!.fire(100, 50);
    flushFrames();
    expect(onSize).toHaveBeenCalledWith({ width: 104, height: 58 });
  });
});

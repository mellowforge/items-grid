import { vi } from 'vitest';

type Callback = (entries: Partial<ResizeObserverEntry>[]) => void;

/** A controllable `ResizeObserver`: jsdom has no layout, so specs fire sizes by hand. */
export class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];
  observed: Element[] = [];
  disconnected = false;

  constructor(readonly callback: Callback) {
    ResizeObserverStub.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.push(element);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  fire(width: number, height: number, border?: { inlineSize: number; blockSize: number }): void {
    this.callback([
      {
        contentRect: { width, height } as DOMRectReadOnly,
        borderBoxSize: border ? [border] : undefined,
      },
    ]);
  }

  /** The observer watching `element`. */
  static for(element: Element): ResizeObserverStub {
    const found = ResizeObserverStub.instances.find(
      observer => !observer.disconnected && observer.observed.includes(element)
    );
    if (!found) throw new Error('no ResizeObserver observes this element');
    return found;
  }
}

let frames: FrameRequestCallback[] = [];

/** Runs every pending `requestAnimationFrame` callback. */
export function flushFrames(): void {
  const pending = frames;
  frames = [];
  pending.forEach(callback => callback(0));
}

/** Installs the stub and a manual animation-frame queue. Undo with `vi.unstubAllGlobals()`. */
export function installLayoutStubs(): void {
  ResizeObserverStub.instances = [];
  frames = [];
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
}

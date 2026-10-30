type Callback = (entries: Partial<ResizeObserverEntry>[]) => void;

/** A controllable `ResizeObserver`: jsdom has no layout, so specs fire sizes by hand. */
export class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];
  observed: Element[] = [];
  options: (ResizeObserverOptions | undefined)[] = [];
  disconnected = false;

  constructor(readonly callback: Callback) {
    ResizeObserverStub.instances.push(this);
  }

  observe(element: Element, options?: ResizeObserverOptions): void {
    this.observed.push(element);
    this.options.push(options);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  fire(width: number, height: number, border?: { inlineSize: number; blockSize: number }): void {
    this.callback([
      {
        target: this.observed[0]!,
        contentRect: { width, height } as DOMRectReadOnly,
        borderBoxSize: border ? [border] : undefined,
      },
    ]);
  }

  /** The live observer watching `element`. */
  static for(element: Element): ResizeObserverStub {
    const found = ResizeObserverStub.instances.find(
      (observer) => !observer.disconnected && observer.observed.includes(element),
    );
    if (!found) throw new Error('no ResizeObserver observes this element');
    return found;
  }
}

const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;

/** Runs every pending `requestAnimationFrame` callback. */
export function flushFrames(): void {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((callback) => callback(0));
}

/** Installs the stub and a manual animation-frame queue. Undo with `vi.unstubAllGlobals()`. */
export function installLayoutStubs(): void {
  ResizeObserverStub.instances = [];
  frames.clear();
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames.delete(id);
  });
}

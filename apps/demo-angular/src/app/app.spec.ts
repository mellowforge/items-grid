import { TestBed } from '@angular/core/testing';

import { flushFrames, installLayoutStubs, ResizeObserverStub } from '../test-utils/resize-observer';
import { App } from './app';

beforeEach(() => {
  installLayoutStubs();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('demo-angular', () => {
  it('renders one page of sample cards once the grid is measured', async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    ResizeObserverStub.for(element.querySelector('[role="list"]')!).fire(1318, 552);
    flushFrames();
    await fixture.whenStable();
    expect(element.querySelectorAll('[role="listitem"]')).toHaveLength(12);
    expect(element.querySelector('.qf-items-grid-pager__status')!.textContent!.trim()).toBe(
      'Items 1–12 of 120',
    );
    fixture.destroy();
  });
});

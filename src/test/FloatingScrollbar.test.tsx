import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { FloatingScrollbar } from '../components/shared/FloatingScrollbar';

type IntersectionCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

function mockIntersectionObserver() {
  let capturedCallback: IntersectionCallback | null = null;
  class FakeIntersectionObserver {
    constructor(callback: IntersectionCallback) {
      capturedCallback = callback;
    }
    observe() { /* no-op */ }
    unobserve() { /* no-op */ }
    disconnect() { /* no-op */ }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).IntersectionObserver = FakeIntersectionObserver;
  return {
    fire: (isIntersecting: boolean) => capturedCallback?.([{ isIntersecting }]),
  };
}

describe('FloatingScrollbar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render nothing when the target has no horizontal overflow', () => {
    const targetRef = createRef<HTMLDivElement>();
    const { container } = render(
      <div>
        <div ref={targetRef} style={{ width: '100px' }} />
        <FloatingScrollbar targetRef={targetRef} />
      </div>
    );

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
  });

  it('should stay hidden while the target’s own scrollbar is still on-screen', () => {
    mockIntersectionObserver();
    const targetRef = createRef<HTMLDivElement>();
    Object.defineProperty(HTMLDivElement.prototype, 'scrollWidth', { configurable: true, value: 2000 });
    Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', { configurable: true, value: 500 });

    const { container } = render(
      <div>
        <div ref={targetRef} />
        <FloatingScrollbar targetRef={targetRef} />
      </div>
    );

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
  });

  it('should appear once the target overflows and its own scrollbar scrolls out of view', () => {
    const { fire } = mockIntersectionObserver();
    const targetRef = createRef<HTMLDivElement>();
    Object.defineProperty(HTMLDivElement.prototype, 'scrollWidth', { configurable: true, value: 2000 });
    Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', { configurable: true, value: 500 });

    const { container } = render(
      <div>
        <div ref={targetRef} />
        <FloatingScrollbar targetRef={targetRef} />
      </div>
    );

    act(() => fire(false)); // sentinel scrolled out of view -> native scrollbar unreachable
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  /** Backs `scrollLeft` with a real read/write accessor, since jsdom's native one is a no-op. */
  function makeScrollLeftSettable(el: HTMLElement, initial = 0) {
    let value = initial;
    Object.defineProperty(el, 'scrollLeft', {
      configurable: true,
      get: () => value,
      set: (v: number) => { value = v; },
    });
  }

  it('should mirror the target’s scrollLeft onto the floating track', () => {
    const { fire } = mockIntersectionObserver();
    const targetRef = createRef<HTMLDivElement>();
    Object.defineProperty(HTMLDivElement.prototype, 'scrollWidth', { configurable: true, value: 2000 });
    Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', { configurable: true, value: 500 });

    const { container } = render(
      <div>
        <div ref={targetRef} />
        <FloatingScrollbar targetRef={targetRef} />
      </div>
    );
    act(() => fire(false));

    const track = container.querySelector('[aria-hidden="true"]') as HTMLDivElement;
    makeScrollLeftSettable(track);
    makeScrollLeftSettable(targetRef.current!, 250);
    fireEvent.scroll(targetRef.current!);

    expect(track.scrollLeft).toBe(250);
  });

  it('should mirror the floating track’s scrollLeft back onto the target', () => {
    const { fire } = mockIntersectionObserver();
    const targetRef = createRef<HTMLDivElement>();
    Object.defineProperty(HTMLDivElement.prototype, 'scrollWidth', { configurable: true, value: 2000 });
    Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', { configurable: true, value: 500 });

    const { container } = render(
      <div>
        <div ref={targetRef} />
        <FloatingScrollbar targetRef={targetRef} />
      </div>
    );
    act(() => fire(false));

    const track = container.querySelector('[aria-hidden="true"]') as HTMLDivElement;
    makeScrollLeftSettable(targetRef.current!);
    makeScrollLeftSettable(track, 400);
    fireEvent.scroll(track);

    expect(targetRef.current!.scrollLeft).toBe(400);
  });
});

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { FloatingScrollbar } from '../components/shared/FloatingScrollbar';

describe('FloatingScrollbar', () => {
  afterEach(() => {
    delete (HTMLDivElement.prototype as unknown as { scrollWidth?: unknown }).scrollWidth;
    delete (HTMLDivElement.prototype as unknown as { clientWidth?: unknown }).clientWidth;
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

  it('should appear whenever the target has horizontal overflow, regardless of vertical scroll position', () => {
    const targetRef = createRef<HTMLDivElement>();
    Object.defineProperty(HTMLDivElement.prototype, 'scrollWidth', { configurable: true, value: 2000 });
    Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', { configurable: true, value: 500 });

    const { container } = render(
      <div>
        <div ref={targetRef} />
        <FloatingScrollbar targetRef={targetRef} />
      </div>
    );

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('should match the target\'s own left position and width, not span the full viewport', () => {
    const targetRef = createRef<HTMLDivElement>();
    Object.defineProperty(HTMLDivElement.prototype, 'scrollWidth', { configurable: true, value: 2000 });
    Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', { configurable: true, value: 500 });

    const { container } = render(
      <div>
        <div ref={targetRef} />
        <FloatingScrollbar targetRef={targetRef} />
      </div>
    );
    // The target's own rect (distinct from jsdom's default 0/400 mock elsewhere in the tree).
    targetRef.current!.getBoundingClientRect = () => ({
      left: 120, width: 640, top: 0, right: 760, bottom: 0, height: 0, x: 120, y: 0,
      toJSON: () => ({}),
    });
    fireEvent(window, new Event('resize'));

    const bar = container.querySelector('[aria-hidden="true"]') as HTMLDivElement;
    expect(bar.style.left).toBe('120px');
    expect(bar.style.width).toBe('640px');
  });

  it('should re-measure position and overflow on window resize', () => {
    const targetRef = createRef<HTMLDivElement>();
    const state = { scrollWidth: 500, clientWidth: 500 };
    Object.defineProperty(HTMLDivElement.prototype, 'scrollWidth', { configurable: true, get: () => state.scrollWidth });
    Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', { configurable: true, get: () => state.clientWidth });

    const { container } = render(
      <div>
        <div ref={targetRef} />
        <FloatingScrollbar targetRef={targetRef} />
      </div>
    );

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();

    // The window shrinking (or a sidebar collapsing) makes the same table overflow, without
    // any DOM mutation inside the target for the MutationObserver to catch.
    state.scrollWidth = 2000;
    fireEvent(window, new Event('resize'));

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('should detect overflow that only appears once the target\'s content changes later, not just at mount', async () => {
    const targetRef = createRef<HTMLDivElement>();
    const state = { scrollWidth: 500, clientWidth: 500 };
    Object.defineProperty(HTMLDivElement.prototype, 'scrollWidth', { configurable: true, get: () => state.scrollWidth });
    Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', { configurable: true, get: () => state.clientWidth });

    const { container } = render(
      <div>
        <div ref={targetRef} />
        <FloatingScrollbar targetRef={targetRef} />
      </div>
    );

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();

    // Content (e.g. table rows) arrives asynchronously after mount and grows the target wider —
    // a real scenario for a table whose rows populate via a follow-up effect in its parent.
    state.scrollWidth = 2000;
    await act(async () => {
      targetRef.current!.appendChild(document.createElement('span'));
      await Promise.resolve();
    });

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

  it('should mirror the target\'s scrollLeft onto the floating track', () => {
    const targetRef = createRef<HTMLDivElement>();
    Object.defineProperty(HTMLDivElement.prototype, 'scrollWidth', { configurable: true, value: 2000 });
    Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', { configurable: true, value: 500 });

    const { container } = render(
      <div>
        <div ref={targetRef} />
        <FloatingScrollbar targetRef={targetRef} />
      </div>
    );

    const track = container.querySelector('[aria-hidden="true"]') as HTMLDivElement;
    makeScrollLeftSettable(track);
    makeScrollLeftSettable(targetRef.current!, 250);
    fireEvent.scroll(targetRef.current!);

    expect(track.scrollLeft).toBe(250);
  });

  it('should not start the belt-and-suspenders polling interval under Vitest', () => {
    // A real setInterval that outlives a single test's synchronous
    // assertions is a classic source of "not wrapped in act()" warnings —
    // this locks in that the guard actually skips it during tests.
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const targetRef = createRef<HTMLDivElement>();

    render(
      <div>
        <div ref={targetRef} />
        <FloatingScrollbar targetRef={targetRef} />
      </div>
    );

    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });

  it('should start (and clean up on unmount) the polling interval outside of Vitest', () => {
    vi.stubEnv('MODE', 'production');
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const targetRef = createRef<HTMLDivElement>();

    const { unmount } = render(
      <div>
        <div ref={targetRef} />
        <FloatingScrollbar targetRef={targetRef} />
      </div>
    );

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 500);
    const intervalId = setIntervalSpy.mock.results[0]!.value;

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('should mirror the floating track\'s scrollLeft back onto the target', () => {
    const targetRef = createRef<HTMLDivElement>();
    Object.defineProperty(HTMLDivElement.prototype, 'scrollWidth', { configurable: true, value: 2000 });
    Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', { configurable: true, value: 500 });

    const { container } = render(
      <div>
        <div ref={targetRef} />
        <FloatingScrollbar targetRef={targetRef} />
      </div>
    );

    const track = container.querySelector('[aria-hidden="true"]') as HTMLDivElement;
    makeScrollLeftSettable(targetRef.current!);
    makeScrollLeftSettable(track, 400);
    fireEvent.scroll(track);

    expect(targetRef.current!.scrollLeft).toBe(400);
  });
});

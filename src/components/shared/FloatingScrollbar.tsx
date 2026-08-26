import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface FloatingScrollbarProps {
  /** Ref to the element that actually scrolls horizontally (its own scrollbar may be off-screen). */
  targetRef: React.RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * A slim horizontal scrollbar pinned to the bottom of the browser viewport, matching the
 * target's own horizontal position and width, shown whenever the target has horizontal
 * overflow — regardless of vertical scroll position — so a wide table can always be scrolled
 * sideways without hunting for its own (possibly off-screen) native scrollbar.
 */
export function FloatingScrollbar({ targetRef, className }: FloatingScrollbarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const syncingFrom = useRef<'target' | 'track' | null>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [rect, setRect] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const measure = () => {
      setScrollWidth(target.scrollWidth);
      setHasOverflow(target.scrollWidth > target.clientWidth + 1);
      const r = target.getBoundingClientRect();
      setRect({ left: r.left, width: r.width });
    };
    measure();

    // Watching just the target's own box isn't enough: it's an `overflow: auto` container
    // whose own size is fixed by its parent's layout (e.g. `w-full`) regardless of how wide
    // its scrollable content grows, so its box never actually resizes when a table gains
    // columns/rows — only the content inside it does. Watch that content directly too.
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(target);
    if (target.firstElementChild) resizeObserver.observe(target.firstElementChild);

    // The initial synchronous measure() above can land before the target's real content has
    // settled — e.g. a table whose rows populate via a follow-up effect in its own parent, one
    // or more ticks after this one first mounts, starts out at its empty/placeholder width. How
    // long that takes scales with dataset size (parsing thousands of rows before pagination
    // slices them down takes measurably longer than dozens), so re-measure on any actual DOM
    // change inside the target rather than guessing a fixed delay.
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(target, { childList: true, subtree: true });

    // The target's left/width can change independently of its own size — a sidebar toggling,
    // the window resizing, or the page's own layout reflowing all shift where the table sits
    // without necessarily changing the table's dimensions, so track window resize explicitly
    // too rather than relying solely on the observers above.
    window.addEventListener('resize', measure);

    // Belt-and-suspenders: re-measure on a short interval as well, so a change that manages to
    // slip past every observer above (e.g. a layout shift with no associated DOM mutation or
    // resize event) still gets picked up quickly rather than never.
    const pollId = window.setInterval(measure, 500);

    const onTargetScroll = () => {
      if (syncingFrom.current === 'track') return;
      syncingFrom.current = 'target';
      if (trackRef.current) trackRef.current.scrollLeft = target.scrollLeft;
      syncingFrom.current = null;
    };
    target.addEventListener('scroll', onTargetScroll, { passive: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', measure);
      window.clearInterval(pollId);
      target.removeEventListener('scroll', onTargetScroll);
    };
  }, [targetRef]);

  const handleTrackScroll = () => {
    const target = targetRef.current;
    if (!target || syncingFrom.current === 'target') return;
    syncingFrom.current = 'track';
    target.scrollLeft = trackRef.current?.scrollLeft ?? 0;
    syncingFrom.current = null;
  };

  if (!hasOverflow) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 z-40 overflow-x-auto border-t-2 border-primary/40 bg-muted shadow-[0_-2px_8px_rgba(0,0,0,0.15)]',
        '[&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/70 [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-muted',
        className
      )}
      style={{ left: rect.left, width: rect.width }}
      ref={trackRef}
      onScroll={handleTrackScroll}
      aria-hidden="true"
    >
      <div style={{ width: scrollWidth, height: 1 }} />
    </div>
  );
}

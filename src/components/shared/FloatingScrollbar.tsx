import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface FloatingScrollbarProps {
  /** Ref to the element that actually scrolls horizontally (its own scrollbar may be off-screen). */
  targetRef: React.RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * A slim horizontal scrollbar pinned to the bottom of the viewport, shown only while the
 * target's own native scrollbar (at the target's bottom edge) is scrolled out of view — so a
 * wide table can be scrolled sideways without first scrolling all the way down to reach it.
 */
export function FloatingScrollbar({ targetRef, className }: FloatingScrollbarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const syncingFrom = useRef<'target' | 'track' | null>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const measure = () => {
      setScrollWidth(target.scrollWidth);
      setHasOverflow(target.scrollWidth > target.clientWidth + 1);
    };
    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(target);

    // A 1px sentinel right after the target: while it's on-screen, the target's own
    // bottom edge (and thus its native scrollbar) is reachable, so the floating bar hides.
    const sentinel = document.createElement('div');
    sentinel.style.height = '1px';
    target.insertAdjacentElement('afterend', sentinel);
    sentinelRef.current = sentinel;

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { rootMargin: '0px' }
    );
    intersectionObserver.observe(sentinel);

    const onTargetScroll = () => {
      if (syncingFrom.current === 'track') return;
      syncingFrom.current = 'target';
      if (trackRef.current) trackRef.current.scrollLeft = target.scrollLeft;
      syncingFrom.current = null;
    };
    target.addEventListener('scroll', onTargetScroll, { passive: true });

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      sentinel.remove();
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

  if (!hasOverflow || !visible) return null;

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 overflow-x-auto border-t bg-background/95 backdrop-blur-sm [&::-webkit-scrollbar]:h-3',
        className
      )}
      ref={trackRef}
      onScroll={handleTrackScroll}
      aria-hidden="true"
    >
      <div style={{ width: scrollWidth, height: 1 }} />
    </div>
  );
}

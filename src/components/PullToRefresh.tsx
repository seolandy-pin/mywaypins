import { useRef, useState, type ReactNode, type TouchEvent } from "react";
import { Loader2 } from "lucide-react";

const THRESHOLD = 70;
const MAX_PULL = 120;

/**
 * Touch-based pull-to-refresh. Triggers `onRefresh` when the user pulls down
 * past THRESHOLD at the top of the page and releases. Renders a spinner that
 * appears as the user pulls.
 */
export function PullToRefresh({
  onRefresh,
  children,
  className,
  scrollContainerRef,
}: {
  onRefresh: () => Promise<unknown> | void;
  children: ReactNode;
  className?: string;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}) {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  function atTop() {
    if (typeof window === "undefined") return false;
    const el = scrollContainerRef?.current;
    if (el) return el.scrollTop <= 0;
    return (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
  }

  function onTouchStart(e: TouchEvent) {
    if (refreshing) return;
    if (!atTop()) {
      startY.current = null;
      return;
    }
    // Don't hijack touches that start inside the map or any opt-out element.
    const target = e.target as HTMLElement | null;
    if (target && target.closest('.mapboxgl-map, [data-no-pull-refresh]')) {
      startY.current = null;
      return;
    }
    startY.current = e.touches[0].clientY;
  }

  function onTouchMove(e: TouchEvent) {
    if (startY.current == null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      setPull(0);
      return;
    }
    // dampen
    const eased = Math.min(MAX_PULL, dy * 0.5);
    setPull(eased);
  }

  async function onTouchEnd() {
    if (startY.current == null) return;
    startY.current = null;
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPull(THRESHOLD);
      // Safety net: never let the spinner spin forever, even if onRefresh
      // hangs (network stall, never-resolving promise, etc).
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, 10000));
      try {
        await Promise.race([
          Promise.resolve()
            .then(() => onRefresh())
            .catch((e) => {
              console.warn("[pull-to-refresh] onRefresh failed", e);
            }),
          timeout,
        ]);
      } catch (e) {
        console.warn("[pull-to-refresh] unexpected error", e);
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  }

  const showSpinner = refreshing || pull > 8;
  const indicatorOpacity = Math.min(1, pull / THRESHOLD);

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      style={{
        transform: `translateY(${pull}px)`,
        transition: startY.current == null ? "transform 200ms ease" : "none",
      }}
    >
      <div
        aria-hidden={!showSpinner}
        className="pointer-events-none absolute inset-x-0 -top-12 flex justify-center"
        style={{ opacity: indicatorOpacity }}
      >
        <div className="flex size-10 items-center justify-center rounded-full bg-surface-1 shadow-md ring-1 ring-border">
          <Loader2
            className={`size-5 text-primary ${refreshing ? "animate-spin" : ""}`}
            style={{
              transform: refreshing ? undefined : `rotate(${pull * 3}deg)`,
            }}
          />
        </div>
      </div>
      {children}
    </div>
  );
}

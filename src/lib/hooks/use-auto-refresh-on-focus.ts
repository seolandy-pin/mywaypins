import { useEffect, useRef } from "react";

const MIN_INTERVAL_MS = 30 * 1000;

/**
 * Triggers `refresh()` when the tab/app becomes visible or the window regains
 * focus. Throttled to once every MIN_INTERVAL_MS to avoid hammering the API
 * on rapid tab switches.
 */
export function useAutoRefreshOnFocus(refresh: () => Promise<unknown> | void) {
  const lastRun = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const run = () => {
      const now = Date.now();
      if (now - lastRun.current < MIN_INTERVAL_MS) return;
      lastRun.current = now;
      void refresh();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") run();
    };

    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);
}

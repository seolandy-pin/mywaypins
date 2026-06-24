import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { refreshFollowedChannels } from "@/lib/api/refresh.functions";
import { useAuth } from "@/lib/auth/use-auth";

/**
 * Returns an async refresh() that pulls the latest videos for the current
 * user's followed channels and invalidates all home-screen queries so the
 * UI re-renders with fresh data.
 */
export function useRefreshHome() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const refreshFn = useServerFn(refreshFollowedChannels);

  return useCallback(async () => {
    try {
      if (isAuthenticated) {
        await refreshFn().catch((e) => console.warn("[refresh-home] fetch failed", e));
      }
    } finally {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-followed-channels"] }),
        qc.invalidateQueries({ queryKey: ["my-collections"] }),
        qc.invalidateQueries({ queryKey: ["channel-markers"] }),
        qc.invalidateQueries({ queryKey: ["new-video-flags"] }),
        qc.invalidateQueries({ queryKey: ["new-video-notifications"] }),
      ]);
    }
  }, [isAuthenticated, qc, refreshFn]);
}

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { refreshFollowedChannels } from "@/lib/api/refresh.functions";
import { useAuth } from "@/lib/auth/use-auth";

const STAMP_KEY = "mywaypins:followed_refresh_at";
const MIN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Triggers a YouTube refresh for the current user's followed channels at most
 * once per 30 minutes per browser. Runs after sign-in/page load so the bell
 * indicator reflects newly uploaded videos without waiting for the daily cron.
 */
export function useRefreshFollowedOnLoad() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const refresh = useServerFn(refreshFollowedChannels);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window === "undefined") return;
    const last = Number(localStorage.getItem(STAMP_KEY) ?? "0");
    if (Date.now() - last < MIN_INTERVAL_MS) return;
    localStorage.setItem(STAMP_KEY, String(Date.now()));
    refresh()
      .then((res) => {
        if (res && "newVideos" in res && res.newVideos > 0) {
          qc.invalidateQueries({ queryKey: ["new-video-flags"] });
          qc.invalidateQueries({ queryKey: ["channel-markers"] });
        }
      })
      .catch((e) => console.warn("[refresh-followed] failed", e));
  }, [isAuthenticated, refresh, qc]);
}

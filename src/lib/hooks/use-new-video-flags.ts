import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/use-auth";

const STORAGE_KEY = "mywaypins:channel_last_seen";
const DEFAULT_LOOKBACK_MS = 7 * 24 * 3600 * 1000;

type SeenMap = Record<string, string>;

function readSeenMap(): SeenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as SeenMap) : {};
  } catch {
    return {};
  }
}

function writeSeenMap(map: SeenMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  // Notify listeners in the same tab.
  window.dispatchEvent(new Event("mywaypins:seen-updated"));
}

function lastSeenFor(map: SeenMap, channelId: string): string {
  return map[channelId] ?? new Date(Date.now() - DEFAULT_LOOKBACK_MS).toISOString();
}

/**
 * Per-channel "new video" indicators. The flag for a channel persists
 * until the user opens that specific channel (markChannelSeen).
 */
export function useNewVideoFlags(channelIds: string[]) {
  const { isAuthenticated } = useAuth();
  const [seenMap, setSeenMap] = useState<SeenMap>(readSeenMap);

  useEffect(() => {
    const sync = () => setSeenMap(readSeenMap());
    window.addEventListener("storage", sync);
    window.addEventListener("mywaypins:seen-updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("mywaypins:seen-updated", sync);
    };
  }, []);

  const idsKey = channelIds.slice().sort().join(",");
  const oldestSeen = channelIds.reduce<string>((min, id) => {
    const v = lastSeenFor(seenMap, id);
    return v < min ? v : min;
  }, new Date().toISOString());

  const q = useQuery({
    queryKey: ["new-video-flags", idsKey, oldestSeen],
    enabled: isAuthenticated && channelIds.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("videos")
        .select("channel_id, published_at")
        .in("channel_id", channelIds)
        .gt("published_at", oldestSeen)
        .order("published_at", { ascending: false })
        .limit(500);
      return (data ?? []) as Array<{ channel_id: string; published_at: string }>;
    },
  });

  const rows = q.data ?? [];
  // Only flag the single most recent new video per channel.
  const latestByChannel: Record<string, string> = {};
  for (const r of rows) {
    const prev = latestByChannel[r.channel_id];
    if (!prev || r.published_at > prev) latestByChannel[r.channel_id] = r.published_at;
  }
  const counts: Record<string, number> = {};
  for (const [channelId, publishedAt] of Object.entries(latestByChannel)) {
    if (publishedAt > lastSeenFor(seenMap, channelId)) {
      counts[channelId] = 1;
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const markChannelSeen = useCallback((channelId: string) => {
    const next = { ...readSeenMap(), [channelId]: new Date().toISOString() };
    writeSeenMap(next);
    setSeenMap(next);
  }, []);

  return { counts, total, markChannelSeen };
}

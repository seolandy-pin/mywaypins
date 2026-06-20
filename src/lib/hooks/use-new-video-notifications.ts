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
  window.dispatchEvent(new Event("mywaypins:seen-updated"));
}

function lastSeenFor(map: SeenMap, channelId: string): string {
  return map[channelId] ?? new Date(Date.now() - DEFAULT_LOOKBACK_MS).toISOString();
}

export type NotificationItem = {
  videoDbId: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  channelId: string;
  channelName: string;
  channelThumbnail: string | null;
  unread: boolean;
};

/**
 * Returns the most recent new videos from followed channels (within the last
 * week) joined with channel info, plus unread state derived from the per-channel
 * lastSeen map in localStorage.
 */
export function useNewVideoNotifications(channelIds: string[]) {
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
  const lookbackStart = new Date(Date.now() - DEFAULT_LOOKBACK_MS).toISOString();

  const q = useQuery({
    queryKey: ["new-video-notifications", idsKey],
    enabled: isAuthenticated && channelIds.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("videos")
        .select(
          "id, youtube_video_id, title, thumbnail_url, published_at, channel_id, youtube_channels(id, name, thumbnail_url)"
        )
        .in("channel_id", channelIds)
        .gt("published_at", lookbackStart)
        .order("published_at", { ascending: false })
        .limit(50);
      return (data ?? []) as Array<{
        id: string;
        youtube_video_id: string;
        title: string;
        thumbnail_url: string | null;
        published_at: string;
        channel_id: string;
        youtube_channels: { id: string; name: string; thumbnail_url: string | null } | null;
      }>;
    },
  });

  const items: NotificationItem[] = (q.data ?? []).map((r) => ({
    videoDbId: r.id,
    youtubeId: r.youtube_video_id,
    title: r.title,
    thumbnailUrl: r.thumbnail_url,
    publishedAt: r.published_at,
    channelId: r.channel_id,
    channelName: r.youtube_channels?.name ?? "Unknown",
    channelThumbnail: r.youtube_channels?.thumbnail_url ?? null,
    unread: r.published_at > lastSeenFor(seenMap, r.channel_id),
  }));

  const unreadCount = items.filter((i) => i.unread).length;

  const markChannelSeen = useCallback((channelId: string) => {
    const next = { ...readSeenMap(), [channelId]: new Date().toISOString() };
    writeSeenMap(next);
    setSeenMap(next);
  }, []);

  const markAllSeen = useCallback(() => {
    const now = new Date().toISOString();
    const cur = readSeenMap();
    const next: SeenMap = { ...cur };
    for (const id of channelIds) next[id] = now;
    writeSeenMap(next);
    setSeenMap(next);
  }, [channelIds]);

  return { items, unreadCount, markChannelSeen, markAllSeen, isLoading: q.isLoading };
}

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/use-auth";

const KEY = "mywaypins:channel_seen";
const CHANGE_EVENT = "mywaypins:channel-seen-changed";
const LOOKBACK_DAYS = 7;
const DAY_MS = 24 * 3600 * 1000;

type SeenMap = Record<string, string>;

function readSeen(): SeenMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as SeenMap;
  } catch {
    return {};
  }
}

export function markChannelSeen(channelId: string) {
  if (typeof window === "undefined") return;
  const s = readSeen();
  s[channelId] = new Date().toISOString();
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function markAllChannelsSeen(channelIds: string[]) {
  if (typeof window === "undefined") return;
  const s = readSeen();
  const now = new Date().toISOString();
  for (const id of channelIds) s[id] = now;
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * For each followed channel, look up the latest video's publish time and
 * derive two sets:
 *  - newChannelIds: latest upload is newer than the user's per-channel
 *    "last seen" timestamp. Persists until the user clicks the channel.
 *  - recentChannelIds: latest upload is within the last 24 hours.
 *    Time-based — auto-clears after a day.
 */
export function useNewVideosByChannel(channelIds: string[]) {
  const { isAuthenticated } = useAuth();
  const [seen, setSeen] = useState<SeenMap>(readSeen);

  useEffect(() => {
    const onChange = () => setSeen(readSeen());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const since = new Date(Date.now() - LOOKBACK_DAYS * DAY_MS).toISOString();

  const q = useQuery({
    queryKey: ["latest-video-per-channel", channelIds.join(",")],
    enabled: isAuthenticated && channelIds.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("videos")
        .select("channel_id, published_at")
        .in("channel_id", channelIds)
        .gt("published_at", since)
        .order("published_at", { ascending: false });
      const latest = new Map<string, string>();
      for (const row of data ?? []) {
        if (!row.channel_id || !row.published_at) continue;
        if (!latest.has(row.channel_id)) latest.set(row.channel_id, row.published_at as string);
      }
      return latest;
    },
  });

  const latest = q.data ?? new Map<string, string>();
  const newChannelIds = new Set<string>();
  const recentChannelIds = new Set<string>();
  const dayAgo = Date.now() - DAY_MS;
  for (const [chId, pub] of latest) {
    const pubMs = new Date(pub).getTime();
    const seenAt = seen[chId];
    if (!seenAt || pubMs > new Date(seenAt).getTime()) {
      newChannelIds.add(chId);
    }
    if (pubMs > dayAgo) {
      recentChannelIds.add(chId);
    }
  }
  return { newChannelIds, recentChannelIds };
}

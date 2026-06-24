import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/use-auth";
import { useChannelSeen } from "./use-channel-seen";

const DEFAULT_LOOKBACK_MS = 7 * 24 * 3600 * 1000;

function lastSeenFor(map: Record<string, string>, channelId: string): string {
  return map[channelId] ?? new Date(Date.now() - DEFAULT_LOOKBACK_MS).toISOString();
}

/**
 * Per-channel "new video" indicators. Read state is sourced from the DB
 * (channel_last_seen) so it persists across logout/login and devices.
 */
export function useNewVideoFlags(channelIds: string[]) {
  const { isAuthenticated } = useAuth();
  const { seenMap, markChannelSeen } = useChannelSeen();

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

  return { counts, total, markChannelSeen };
}

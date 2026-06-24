import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/use-auth";
import { useChannelSeen } from "./use-channel-seen";

const DEFAULT_LOOKBACK_MS = 7 * 24 * 3600 * 1000;

function lastSeenFor(map: Record<string, string>, channelId: string): string {
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
 * Recent new videos from followed channels (last 7 days). Read state lives
 * in `public.channel_last_seen` so it persists across logout/login and devices.
 */
export function useNewVideoNotifications(channelIds: string[]) {
  const { isAuthenticated } = useAuth();
  const { seenMap, markChannelSeen, markChannelsSeen } = useChannelSeen();

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

  const markAllSeen = () => markChannelsSeen(channelIds);

  return { items, unreadCount, markChannelSeen, markAllSeen, isLoading: q.isLoading };
}

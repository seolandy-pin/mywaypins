import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/use-auth";

const DEFAULT_LOOKBACK_MS = 7 * 24 * 3600 * 1000;

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
 * Recent new videos from followed channels (last 7 days), excluding any
 * the user has dismissed (read or X'd). Dismissals live in
 * `public.dismissed_notifications` so they persist across devices.
 */
export function useNewVideoNotifications(channelIds: string[]) {
  const { isAuthenticated, user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();

  const idsKey = channelIds.slice().sort().join(",");
  const lookbackStart = new Date(Date.now() - DEFAULT_LOOKBACK_MS).toISOString();

  const dismissedKey = ["dismissed-notifications", userId ?? "anon"] as const;
  const dismissedQuery = useQuery({
    queryKey: dismissedKey,
    enabled: isAuthenticated && !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("dismissed_notifications")
        .select("video_id");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.video_id));
    },
  });

  const videosKey = ["new-video-notifications", idsKey] as const;
  const q = useQuery({
    queryKey: videosKey,
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

  const dismissed = dismissedQuery.data ?? new Set<string>();

  const items: NotificationItem[] = (q.data ?? [])
    .filter((r) => !dismissed.has(r.id))
    .map((r) => ({
      videoDbId: r.id,
      youtubeId: r.youtube_video_id,
      title: r.title,
      thumbnailUrl: r.thumbnail_url,
      publishedAt: r.published_at,
      channelId: r.channel_id,
      channelName: r.youtube_channels?.name ?? "Unknown",
      channelThumbnail: r.youtube_channels?.thumbnail_url ?? null,
      unread: true,
    }));

  const unreadCount = items.length;

  const dismissMutation = useMutation({
    mutationFn: async (videoIds: string[]) => {
      if (!userId || videoIds.length === 0) return;
      const rows = videoIds.map((video_id) => ({ user_id: userId, video_id }));
      const { error } = await supabase
        .from("dismissed_notifications")
        .upsert(rows, { onConflict: "user_id,video_id" });
      if (error) throw error;
    },
    onMutate: async (videoIds) => {
      await qc.cancelQueries({ queryKey: dismissedKey });
      const prev = qc.getQueryData<Set<string>>(dismissedKey) ?? new Set<string>();
      const next = new Set(prev);
      for (const id of videoIds) next.add(id);
      qc.setQueryData(dismissedKey, next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(dismissedKey, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: dismissedKey });
    },
  });

  const dismissOne = useCallback(
    (videoId: string) => dismissMutation.mutate([videoId]),
    [dismissMutation],
  );
  const dismissAll = useCallback(() => {
    const ids = items.map((i) => i.videoDbId);
    if (ids.length === 0) return;
    dismissMutation.mutate(ids);
  }, [dismissMutation, items]);

  return {
    items,
    unreadCount,
    dismissOne,
    dismissAll,
    isLoading: q.isLoading,
  };
}

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth/use-auth";
import { listMyFollowedChannels } from "@/lib/follows.functions";

export type FollowedChannel = {
  id: string;
  youtube_channel_id: string;
  name: string;
  thumbnail_url: string | null;
  subscriber_count: number | null;
  current_location: string | null;
  is_currently_traveling: boolean | null;
};

export function useFollowedChannels() {
  const { isAuthenticated } = useAuth();
  const listFn = useServerFn(listMyFollowedChannels);
  const q = useQuery({
    queryKey: ["my-followed-channels"],
    enabled: isAuthenticated,
    queryFn: () => listFn(),
  });
  const rows = (q.data ?? []) as Array<{ youtube_channels: FollowedChannel | null }>;
  const channels = rows.map((r) => r.youtube_channels).filter((c): c is FollowedChannel => Boolean(c));
  return {
    channels,
    channelIds: channels.map((c) => c.id),
    isAuthenticated,
    loading: q.isLoading,
  };
}

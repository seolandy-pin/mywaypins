import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FollowedChannel } from "@/lib/hooks/use-followed-channels";

export type ChannelMarker = {
  channelId: string;
  name: string;
  thumbnail: string | null;
  location: string;
  lat: number;
  lng: number;
};

/**
 * For each followed channel, find a representative pin (latest) so we can
 * drop a small channel-avatar marker on the home map.
 */
export function useChannelMarkers(channels: FollowedChannel[]) {
  const ids = channels.map((c) => c.id);
  return useQuery({
    queryKey: ["channel-markers", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async (): Promise<ChannelMarker[]> => {
      const { data } = await supabase
        .from("pins")
        .select("channel_id, latitude, longitude, places(city_name, country_name)")
        .in("channel_id", ids)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (!data) return [];
      const byChannel = new Map<string, ChannelMarker>();
      for (const row of data) {
        if (!row.channel_id || byChannel.has(row.channel_id)) continue;
        const ch = channels.find((c) => c.id === row.channel_id);
        if (!ch) continue;
        const place = (row as { places: { city_name?: string; country_name?: string } | null }).places;
        byChannel.set(row.channel_id, {
          channelId: row.channel_id,
          name: ch.name,
          thumbnail: ch.thumbnail_url,
          location: place?.country_name ?? place?.city_name ?? ch.current_location ?? "",
          lat: row.latitude as number,
          lng: row.longitude as number,
        });
      }
      return Array.from(byChannel.values());
    },
  });
}

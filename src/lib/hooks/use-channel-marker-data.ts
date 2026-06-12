import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FollowedChannel } from "@/lib/hooks/use-followed-channels";

export type ChannelMarker = {
  id: string; // pin id (unique per marker)
  channelId: string;
  videoId: string | null;
  name: string;
  thumbnail: string | null;
  location: string;
  lat: number;
  lng: number;
};

/**
 * Returns ONE marker per pin (each video location) carrying the channel's
 * avatar — these replace the generic circle dots on the home map.
 */
export function useChannelMarkers(channels: FollowedChannel[]) {
  const ids = channels.map((c) => c.id);
  return useQuery({
    queryKey: ["channel-markers", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async (): Promise<ChannelMarker[]> => {
      const { data } = await supabase
        .from("pins")
        .select("id, channel_id, latitude, longitude, places(city_name, country_name)")
        .in("channel_id", ids)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (!data) return [];
      const out: ChannelMarker[] = [];
      for (const row of data) {
        if (!row.channel_id) continue;
        const ch = channels.find((c) => c.id === row.channel_id);
        if (!ch) continue;
        const place = (row as { places: { city_name?: string; country_name?: string } | null }).places;
        out.push({
          id: row.id as string,
          channelId: row.channel_id,
          name: ch.name,
          thumbnail: ch.thumbnail_url,
          location: place?.country_name ?? place?.city_name ?? ch.current_location ?? "",
          lat: row.latitude as number,
          lng: row.longitude as number,
        });
      }
      return out;
    },
  });
}

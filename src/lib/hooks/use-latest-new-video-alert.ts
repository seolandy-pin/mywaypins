import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/use-auth";

const DISMISS_KEY = "mywaypins:dismissed_latest_video_id";

export type LatestVideoAlert = {
  videoId: string; // db id
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  channelName: string;
  channelThumbnail: string | null;
  pinId: string;
  lat: number;
  lng: number;
  location: string;
};

function readDismissed(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DISMISS_KEY);
}

/**
 * Picks the SINGLE most recently published video across all followed channels
 * that has at least one geolocated pin. Persists a "dismissed" marker in
 * localStorage so the alert disappears once the user taps [확인 완료].
 */
export function useLatestNewVideoAlert(channelIds: string[]) {
  const { isAuthenticated } = useAuth();
  const [dismissedId, setDismissedId] = useState<string | null>(readDismissed);

  useEffect(() => {
    const sync = () => setDismissedId(readDismissed());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const idsKey = channelIds.slice().sort().join(",");

  const q = useQuery({
    queryKey: ["latest-new-video-alert", idsKey],
    enabled: isAuthenticated && channelIds.length > 0,
    refetchInterval: 60_000,
    queryFn: async (): Promise<LatestVideoAlert | null> => {
      const { data, error } = await supabase
        .from("videos")
        .select(
          "id, title, youtube_video_id, thumbnail_url, published_at, youtube_channels(name, thumbnail_url), pins!inner(id, latitude, longitude, places(city_name, country_name))",
        )
        .in("channel_id", channelIds)
        .not("pins.latitude", "is", null)
        .not("pins.longitude", "is", null)
        .order("published_at", { ascending: false })
        .limit(1);
      if (error || !data || data.length === 0) return null;
      const row = data[0] as {
        id: string;
        title: string;
        youtube_video_id: string;
        thumbnail_url: string | null;
        published_at: string;
        youtube_channels: { name?: string; thumbnail_url?: string } | null;
        pins: Array<{
          id: string;
          latitude: number;
          longitude: number;
          places: { city_name?: string; country_name?: string } | null;
        }>;
      };
      const pin = row.pins[0];
      if (!pin) return null;
      const place = pin.places;
      return {
        videoId: row.id,
        youtubeVideoId: row.youtube_video_id,
        title: row.title,
        thumbnailUrl: row.thumbnail_url,
        publishedAt: row.published_at,
        channelName: row.youtube_channels?.name ?? "",
        channelThumbnail: row.youtube_channels?.thumbnail_url ?? null,
        pinId: pin.id,
        lat: pin.latitude,
        lng: pin.longitude,
        location: [place?.city_name, place?.country_name].filter(Boolean).join(", "),
      };
    },
  });

  const alert = q.data && q.data.videoId !== dismissedId ? q.data : null;

  const dismiss = useCallback(() => {
    if (!q.data) return;
    localStorage.setItem(DISMISS_KEY, q.data.videoId);
    setDismissedId(q.data.videoId);
  }, [q.data]);

  return { alert, dismiss };
}

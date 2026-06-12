import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/use-auth";

const STORAGE_KEY = "mywaypins:last_seen_videos";

function getLastSeen(): string {
  if (typeof window === "undefined") return new Date(0).toISOString();
  return localStorage.getItem(STORAGE_KEY) ?? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
}

export function markVideosSeen() {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, new Date().toISOString());
}

/**
 * Count of new videos from followed channels since the user last opened
 * the notifications panel. Drives the bell badge on the home header.
 */
export function useNewVideoCount(channelIds: string[]) {
  const { isAuthenticated } = useAuth();
  const [lastSeen, setLastSeen] = useState<string>(getLastSeen);

  useEffect(() => {
    const onStorage = () => setLastSeen(getLastSeen());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const q = useQuery({
    queryKey: ["new-video-count", channelIds.join(","), lastSeen],
    enabled: isAuthenticated && channelIds.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("videos")
        .select("id", { count: "exact", head: true })
        .in("channel_id", channelIds)
        .gt("published_at", lastSeen);
      return count ?? 0;
    },
  });

  return {
    count: q.data ?? 0,
    refresh: () => setLastSeen(getLastSeen()),
  };
}

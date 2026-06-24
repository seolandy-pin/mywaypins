import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/use-auth";

export type SeenMap = Record<string, string>;

const QUERY_KEY = ["channel-last-seen"] as const;

/**
 * DB-backed per-channel "last seen" timestamps for the current user.
 * Replaces the previous localStorage-only implementation so that read
 * state survives logout/login and syncs across devices.
 */
export function useChannelSeen() {
  const { isAuthenticated, user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: [...QUERY_KEY, userId ?? "anon"],
    enabled: isAuthenticated && !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<SeenMap> => {
      const { data, error } = await supabase
        .from("channel_last_seen")
        .select("channel_id, last_seen_at");
      if (error) throw error;
      const map: SeenMap = {};
      for (const row of data ?? []) map[row.channel_id] = row.last_seen_at;
      return map;
    },
  });

  const mutation = useMutation({
    mutationFn: async (channelIds: string[]) => {
      if (!userId || channelIds.length === 0) return;
      const now = new Date().toISOString();
      const rows = channelIds.map((channel_id) => ({
        user_id: userId,
        channel_id,
        last_seen_at: now,
      }));
      const { error } = await supabase
        .from("channel_last_seen")
        .upsert(rows, { onConflict: "user_id,channel_id" });
      if (error) throw error;
    },
    onMutate: async (channelIds) => {
      await qc.cancelQueries({ queryKey: [...QUERY_KEY, userId ?? "anon"] });
      const prev = qc.getQueryData<SeenMap>([...QUERY_KEY, userId ?? "anon"]) ?? {};
      const next = { ...prev };
      const now = new Date().toISOString();
      for (const id of channelIds) next[id] = now;
      qc.setQueryData([...QUERY_KEY, userId ?? "anon"], next);
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData([...QUERY_KEY, userId ?? "anon"], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [...QUERY_KEY, userId ?? "anon"] });
    },
  });

  const markChannelSeen = useCallback(
    (channelId: string) => {
      mutation.mutate([channelId]);
    },
    [mutation],
  );

  const markChannelsSeen = useCallback(
    (channelIds: string[]) => {
      if (channelIds.length === 0) return;
      mutation.mutate(channelIds);
    },
    [mutation],
  );

  return {
    seenMap: query.data ?? {},
    isLoading: query.isLoading,
    markChannelSeen,
    markChannelsSeen,
  };
}

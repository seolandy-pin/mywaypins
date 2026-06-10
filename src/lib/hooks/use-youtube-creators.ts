import { useQuery } from "@tanstack/react-query";
import { popularCreators, type PopularCreator } from "@/lib/sample-data";

function formatSubs(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

type YouTubeChannelItem = {
  id: string;
  snippet: { title: string; thumbnails: { default?: { url: string }; medium?: { url: string }; high?: { url: string } } };
  statistics: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
};

async function fetchChannelByHandle(handle: string, apiKey: string): Promise<YouTubeChannelItem | null> {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  const json = (await res.json()) as { items?: YouTubeChannelItem[] };
  return json.items?.[0] ?? null;
}

export function usePopularCreators(): { creators: PopularCreator[]; loading: boolean } {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["popular-creators", apiKey ? "live" : "seed"],
    enabled: Boolean(apiKey),
    staleTime: 1000 * 60 * 60, // 1h
    queryFn: async () => {
      const results = await Promise.all(
        popularCreators.map(async (c) => {
          if (!c.handle) return c;
          try {
            const item = await fetchChannelByHandle(c.handle, apiKey!);
            if (!item) return c;
            const subs = item.statistics.hiddenSubscriberCount
              ? c.subs
              : formatSubs(Number(item.statistics.subscriberCount ?? 0));
            return {
              ...c,
              name: item.snippet.title,
              avatar:
                item.snippet.thumbnails.high?.url ??
                item.snippet.thumbnails.medium?.url ??
                item.snippet.thumbnails.default?.url ??
                c.avatar,
              subs,
              channelId: item.id,
            } satisfies PopularCreator;
          } catch (e) {
            console.warn(`[youtube] failed to load @${c.handle}`, e);
            return c;
          }
        }),
      );
      return results;
    },
  });

  return { creators: data ?? popularCreators, loading: isLoading && Boolean(apiKey) };
}

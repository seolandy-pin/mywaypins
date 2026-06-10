import { createServerFn } from "@tanstack/react-start";

export type YTChannelResult = {
  id: string;
  title: string;
  customUrl?: string;
  thumbnail: string;
  subscriberCount: number | null;
};

export const searchYouTubeChannelsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }): Promise<YTChannelResult[]> => {
    const q = data.q.trim();
    if (q.length < 2) return [];
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("YOUTUBE_API_KEY not configured");

    const sUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=8&q=${encodeURIComponent(q)}&key=${apiKey}`;
    const sRes = await fetch(sUrl);
    if (!sRes.ok) throw new Error(`YouTube search ${sRes.status}`);
    const sJson = (await sRes.json()) as { items?: Array<{ id: { channelId: string } }> };
    const ids = (sJson.items ?? []).map((i) => i.id.channelId).filter(Boolean);
    if (ids.length === 0) return [];

    const dUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${ids.join(",")}&key=${apiKey}`;
    const dRes = await fetch(dUrl);
    if (!dRes.ok) throw new Error(`YouTube channels ${dRes.status}`);
    const dJson = (await dRes.json()) as {
      items?: Array<{
        id: string;
        snippet: {
          title: string;
          customUrl?: string;
          thumbnails: { default?: { url: string }; medium?: { url: string }; high?: { url: string } };
        };
        statistics: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
      }>;
    };
    return (dJson.items ?? []).map((c) => ({
      id: c.id,
      title: c.snippet.title,
      customUrl: c.snippet.customUrl?.replace(/^@/, ""),
      thumbnail: c.snippet.thumbnails.medium?.url ?? c.snippet.thumbnails.default?.url ?? "",
      subscriberCount: c.statistics.hiddenSubscriberCount ? null : Number(c.statistics.subscriberCount ?? 0),
    }));
  });

export type YTChannelDetail = {
  id: string;
  title: string;
  description: string;
  customUrl?: string;
  avatar: string;
  subscriberCount: number | null;
};

export const getYouTubeChannelByHandleFn = createServerFn({ method: "GET" })
  .inputValidator((d: { handle: string }) => d)
  .handler(async ({ data }): Promise<YTChannelDetail | null> => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("YOUTUBE_API_KEY not configured");
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${encodeURIComponent(data.handle)}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube API ${res.status}`);
    const json = (await res.json()) as {
      items?: Array<{
        id: string;
        snippet: {
          title: string;
          description: string;
          customUrl?: string;
          thumbnails: { default?: { url: string }; medium?: { url: string }; high?: { url: string } };
        };
        statistics: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
      }>;
    };
    const c = json.items?.[0];
    if (!c) return null;
    return {
      id: c.id,
      title: c.snippet.title,
      description: c.snippet.description,
      customUrl: c.snippet.customUrl?.replace(/^@/, ""),
      avatar: c.snippet.thumbnails.high?.url ?? c.snippet.thumbnails.medium?.url ?? c.snippet.thumbnails.default?.url ?? "",
      subscriberCount: c.statistics.hiddenSubscriberCount ? null : Number(c.statistics.subscriberCount ?? 0),
    };
  });

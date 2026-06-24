import { createServerFn } from "@tanstack/react-start";
import { hasYouTubeKey, ytFetch } from "@/lib/youtube-keys";

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
    if (!hasYouTubeKey()) throw new Error("YOUTUBE_API_KEY not configured");

    const sRes = await ytFetch(
      (key) =>
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=8&q=${encodeURIComponent(q)}&key=${key}`,
    );
    if (!sRes.ok) {
      if (sRes.status === 403 || sRes.status === 429 || sRes.status >= 500) {
        const body = await sRes.text().catch(() => "");
        console.warn(`[youtube] search quota/fallback, status=${sRes.status}`, body);
        throw new Error("YOUTUBE_QUOTA_EXCEEDED");
      }
      throw new Error(`YouTube search ${sRes.status}`);
    }
    const sJson = (await sRes.json()) as { items?: Array<{ id: { channelId: string } }> };
    const ids = (sJson.items ?? []).map((i) => i.id.channelId).filter(Boolean);
    if (ids.length === 0) return [];

    const dRes = await ytFetch(
      (key) =>
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${ids.join(",")}&key=${key}`,
    );
    if (!dRes.ok) {
      if (dRes.status === 429 || dRes.status >= 500) {
        console.warn(`[youtube] channels fallback, status=${dRes.status}`);
        return [];
      }
      throw new Error(`YouTube channels ${dRes.status}`);
    }
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
    if (!hasYouTubeKey()) throw new Error("YOUTUBE_API_KEY not configured");
    // Accept either an @handle or a channel ID (starts with "UC").
    const isChannelId = /^UC[\w-]{20,}$/.test(data.handle);
    const res = await ytFetch((key) =>
      isChannelId
        ? `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(data.handle)}&key=${key}`
        : `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${encodeURIComponent(data.handle)}&key=${key}`,
    );
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


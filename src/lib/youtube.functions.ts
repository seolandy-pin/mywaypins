import { createServerFn } from "@tanstack/react-start";
import { hasYouTubeKey, ytFetch } from "@/lib/youtube-keys";

export type YTChannelResult = {
  id: string;
  title: string;
  customUrl?: string;
  thumbnail: string;
  subscriberCount: number | null;
};

type ChannelApiItem = {
  id: string;
  snippet: {
    title: string;
    description?: string;
    customUrl?: string;
    thumbnails: { default?: { url: string }; medium?: { url: string }; high?: { url: string } };
  };
  statistics: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
};

function mapChannel(c: ChannelApiItem): YTChannelResult {
  return {
    id: c.id,
    title: c.snippet.title,
    customUrl: c.snippet.customUrl?.replace(/^@/, ""),
    thumbnail: c.snippet.thumbnails.medium?.url ?? c.snippet.thumbnails.default?.url ?? "",
    subscriberCount: c.statistics.hiddenSubscriberCount ? null : Number(c.statistics.subscriberCount ?? 0),
  };
}

// Travel / food (mukbang, restaurant tour) keyword filter. Applied to the
// channel title + description so generic news/music/gaming channels are
// excluded from search results.
const TRAVEL_FOOD_RE_EN =
  /\b(travel|traveler|traveller|traveling|travelling|tourist|tourism|tour|tours|touring|trip|trips|journey|journeys|adventure|adventures|wander|wanderlust|explore|explorer|exploring|expedition|nomad|backpack|backpacker|backpacking|vlog|vlogger|vlogs|itinerary|destination|destinations|holiday|holidays|vacation|vacations|getaway|cruise|safari|hiking|trekking|road\s*trip|world|globe|abroad|overseas|country|countries|city\s*guide|food|foodie|foods|eat|eats|eating|eater|restaurant|restaurants|cuisine|culinary|chef|cook|cooking|recipe|recipes|kitchen|street\s*food|mukbang|asmr\s*eating|tasting|taste\s*test|dining|gourmet|delicious|yummy|bbq|brunch|breakfast|lunch|dinner|cafe|coffee|bakery|dessert|drinks)\b/i;

// Korean keywords — \b word boundaries don't work for Hangul, so match without them.
const TRAVEL_FOOD_RE_KO =
  /(여행|세계여행|해외여행|국내여행|배낭여행|자유여행|여행기|여행지|관광|투어|브이로그|브이로거|탐험|모험|유랑|방랑|순례|기차여행|캠핑|등산|트레킹|크루즈|호텔|숙소|맛집|먹방|먹스타그램|미식|식당|레스토랑|카페|디저트|베이커리|요리|쿡방|레시피|길거리음식|야시장|시장|술집|와인|커피)/;

function looksLikeTravelOrFood(c: ChannelApiItem): boolean {
  const text = `${c.snippet.title ?? ""} ${c.snippet.description ?? ""}`;
  return TRAVEL_FOOD_RE_EN.test(text) || TRAVEL_FOOD_RE_KO.test(text);
}


// A query "looks like a handle" when it has no spaces and only handle-safe chars.
// channels?forHandle costs 1 unit vs search.list at 100 units.
function looksLikeHandle(q: string): boolean {
  return /^@?[A-Za-z0-9._-]{2,}$/.test(q);
}

function isTemporaryYouTubeFailure(status: number): boolean {
  return status === 403 || status === 429 || status >= 500;
}


export const searchYouTubeChannelsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }): Promise<YTChannelResult[]> => {
    const q = data.q.trim();
    if (q.length < 2) return [];
    if (!hasYouTubeKey()) throw new Error("YOUTUBE_API_KEY not configured");

    // v3 prefix: results are now filtered to travel/food channels only.
    const cacheKey = `channels:v4:${q.toLowerCase()}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Cache lookup (0 quota units).
    const { data: cached } = await supabaseAdmin
      .from("youtube_search_cache")
      .select("results, expires_at")
      .eq("query", cacheKey)
      .maybeSingle();
    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      return cached.results as YTChannelResult[];
    }

    const writeCache = async (results: YTChannelResult[]) => {
      await supabaseAdmin
        .from("youtube_search_cache")
        .upsert(
          {
            query: cacheKey,
            results: results as unknown as never,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
          { onConflict: "query" },
        );
    };

    // 2) Handle-style queries: try forHandle first (1 unit). An exact handle
    //    match is a deliberate lookup, so we still apply the travel/food filter
    //    afterwards to keep the surface consistent across all three search UIs.
    if (looksLikeHandle(q)) {
      const handle = q.replace(/^@/, "");
      const hRes = await ytFetch(
        (key) =>
          `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${encodeURIComponent(handle)}&key=${key}`,
      );
      if (hRes.ok) {
        const hJson = (await hRes.json()) as { items?: ChannelApiItem[] };
        const item = hJson.items?.[0];
        if (item && looksLikeTravelOrFood(item)) {
          const results = [mapChannel(item)];
          await writeCache(results);
          return results;
        }
      }
      if (isTemporaryYouTubeFailure(hRes.status)) {
        const body = await hRes.text().catch(() => "");
        console.warn(`[youtube] channel handle lookup unavailable, status=${hRes.status}`, body);
        return [];
      }
      // Fall through to search.list if handle lookup yielded nothing.
    }

    // 3) Fallback: search.list (100 units) — only when forHandle didn't resolve.
    //    Bias the query toward travel/food channels via boolean OR keywords.
    const topical = "(travel | vlog | tour | trip | itinerary | food | restaurant | mukbang | foodie)";
    const filteredQ = `${q} ${topical}`;
    const sRes = await ytFetch(
      (key) =>
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=15&q=${encodeURIComponent(filteredQ)}&key=${key}`,
    );
    if (!sRes.ok) {
      if (isTemporaryYouTubeFailure(sRes.status)) {
        const body = await sRes.text().catch(() => "");
        console.warn(`[youtube] search quota/fallback, status=${sRes.status}`, body);
        return [];
      }
      throw new Error(`YouTube search ${sRes.status}`);
    }
    const sJson = (await sRes.json()) as { items?: Array<{ id: { channelId: string } }> };
    const ids = (sJson.items ?? []).map((i) => i.id.channelId).filter(Boolean);
    if (ids.length === 0) {
      await writeCache([]);
      return [];
    }

    const dRes = await ytFetch(
      (key) =>
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${ids.join(",")}&key=${key}`,
    );
    if (!dRes.ok) {
      if (isTemporaryYouTubeFailure(dRes.status)) {
        console.warn(`[youtube] channels fallback, status=${dRes.status}`);
        return [];
      }
      throw new Error(`YouTube channels ${dRes.status}`);
    }
    const dJson = (await dRes.json()) as { items?: ChannelApiItem[] };
    // Post-filter on title + description to drop anything that slipped past
    // the q-side boolean (e.g. matched "tour" in a music tour).
    const filteredItems = (dJson.items ?? []).filter(looksLikeTravelOrFood);
    const results = filteredItems.slice(0, 8).map(mapChannel);
    await writeCache(results);
    return results;
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

export type YTVideoResult = {
  id: string;
  title: string;
  thumbnail: string;
  channelId: string;
  channelTitle: string;
  channelHandle?: string;
  channelThumbnail?: string;
  viewCount: number | null;
  publishedAt?: string;
};

/**
 * Search popular videos for a place/topic query.
 * Used by the search screen so that "Japan", "Bali", etc. surface the
 * most-viewed travel videos. Results are cached 24h to save quota.
 */
export const searchYouTubeVideosFn = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }): Promise<YTVideoResult[]> => {
    const q = data.q.trim();
    if (q.length < 2) return [];
    if (!hasYouTubeKey()) throw new Error("YOUTUBE_API_KEY not configured");

    // v2 prefix invalidates pre-filter cached results (travel/food topical filter).
    const cacheKey = `videos:v2:${q.toLowerCase()}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cached } = await supabaseAdmin
      .from("youtube_search_cache")
      .select("results, expires_at")
      .eq("query", cacheKey)
      .maybeSingle();
    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      return cached.results as YTVideoResult[];
    }

    const writeCache = async (results: YTVideoResult[]) => {
      await supabaseAdmin
        .from("youtube_search_cache")
        .upsert(
          {
            query: cacheKey,
            results: results as unknown as never,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
          { onConflict: "query" },
        );
    };

    // Constrain results to travel + food/restaurant content only — combine the
    // place query with a topical OR-group so news/entertainment is filtered out.
    // YouTube search supports boolean OR via the `|` operator inside the q param.
    const topical = "(travel | vlog | tour | trip | itinerary | food | restaurant | eats | foodie | mukbang)";
    const filteredQ = `${q} ${topical}`;
    // order=viewCount surfaces the most popular videos for the term first.
    // videoCategoryId=19 = Travel & Events (broad enough to also include food vlogs travelling there;
    // we keep it off to avoid over-filtering, the boolean q is the primary filter).
    const sRes = await ytFetch(
      (key) =>
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&maxResults=12&relevanceLanguage=en&q=${encodeURIComponent(filteredQ)}&key=${key}`,
    );

    if (!sRes.ok) {
      if (isTemporaryYouTubeFailure(sRes.status)) {
        console.warn(`[youtube] video search unavailable, status=${sRes.status}`);
        return [];
      }
      throw new Error(`YouTube video search ${sRes.status}`);
    }
    const sJson = (await sRes.json()) as {
      items?: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          channelId: string;
          channelTitle: string;
          publishedAt: string;
          thumbnails: { default?: { url: string }; medium?: { url: string }; high?: { url: string } };
        };
      }>;
    };
    const items = sJson.items ?? [];
    const videoIds = items.map((i) => i.id.videoId).filter(Boolean);
    if (videoIds.length === 0) {
      await writeCache([]);
      return [];
    }

    // Fetch view counts (statistics) for ranking display.
    const vRes = await ytFetch(
      (key) =>
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds.join(",")}&key=${key}`,
    );
    const viewCountById = new Map<string, number | null>();
    if (vRes.ok) {
      const vJson = (await vRes.json()) as {
        items?: Array<{ id: string; statistics: { viewCount?: string } }>;
      };
      for (const it of vJson.items ?? []) {
        viewCountById.set(it.id, it.statistics.viewCount ? Number(it.statistics.viewCount) : null);
      }
    }

    // Fetch channel handles + thumbnails (so the Follow button has good metadata).
    const channelIds = Array.from(new Set(items.map((i) => i.snippet.channelId)));
    const cRes = await ytFetch(
      (key) =>
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelIds.join(",")}&key=${key}`,
    );
    const channelMetaById = new Map<string, { handle?: string; thumbnail?: string }>();
    if (cRes.ok) {
      const cJson = (await cRes.json()) as {
        items?: Array<{
          id: string;
          snippet: {
            customUrl?: string;
            thumbnails: { default?: { url: string }; medium?: { url: string }; high?: { url: string } };
          };
        }>;
      };
      for (const it of cJson.items ?? []) {
        channelMetaById.set(it.id, {
          handle: it.snippet.customUrl?.replace(/^@/, ""),
          thumbnail:
            it.snippet.thumbnails.medium?.url ??
            it.snippet.thumbnails.default?.url ??
            it.snippet.thumbnails.high?.url,
        });
      }
    }

    const results: YTVideoResult[] = items.map((i) => {
      const meta = channelMetaById.get(i.snippet.channelId) ?? {};
      return {
        id: i.id.videoId,
        title: i.snippet.title,
        thumbnail:
          i.snippet.thumbnails.high?.url ??
          i.snippet.thumbnails.medium?.url ??
          i.snippet.thumbnails.default?.url ??
          "",
        channelId: i.snippet.channelId,
        channelTitle: i.snippet.channelTitle,
        channelHandle: meta.handle,
        channelThumbnail: meta.thumbnail,
        viewCount: viewCountById.get(i.id.videoId) ?? null,
        publishedAt: i.snippet.publishedAt,
      };
    });

    await writeCache(results);
    return results;
  });


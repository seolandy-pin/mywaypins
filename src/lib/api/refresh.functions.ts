import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasYouTubeKey, ytFetch } from "@/lib/youtube-keys";


/**
 * Refreshes followed channels' videos on demand. Pulls the latest 20 + top 20
 * most-viewed videos per followed channel from YouTube and upserts them.
 * Returns the number of newly discovered videos.
 */
export const refreshFollowedChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!hasYouTubeKey()) return { ok: false, newVideos: 0, reason: "missing-key" as const };



    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { extractLocations } = await import("@/lib/api/channels.functions");

    // Only refresh channels THIS user follows (keeps work bounded per call).
    const { data: followRows } = await context.supabase
      .from("followers")
      .select("channel_id")
      .eq("user_id", context.userId);
    const channelIds = Array.from(
      new Set(((followRows ?? []).map((r) => r.channel_id).filter(Boolean)) as string[]),
    );
    if (channelIds.length === 0) return { ok: true, newVideos: 0 };

    const { data: channels } = await supabaseAdmin
      .from("youtube_channels")
      .select("id, youtube_channel_id")
      .in("id", channelIds);

    let totalNew = 0;
    for (const ch of channels ?? []) {
      if (!ch.youtube_channel_id) continue;
      try {
        totalNew += await refreshChannel(
          ch.id,
          ch.youtube_channel_id,
          supabaseAdmin,
          extractLocations,
        );

      } catch (e) {
        console.error("[refreshFollowedChannels] channel failed", ch.id, e);
      }
    }
    return { ok: true, newVideos: totalNew };
  });

type SearchItem = {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    thumbnails: { high?: { url: string } };
  };
};
type SearchResp = { items?: SearchItem[]; nextPageToken?: string };

async function fetchN(
  channelId: string,
  order: "date" | "viewCount",
  want: number,
  exclude: Set<string>,
): Promise<SearchItem[]> {
  const out: SearchItem[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3 && out.length < want; page++) {
    const r = await ytFetch(
      (key) =>
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}` +
        `&maxResults=50&order=${order}&type=video&key=${key}` +
        (pageToken ? `&pageToken=${pageToken}` : ""),
    );
    if (!r.ok) break;
    const j = (await r.json()) as SearchResp;
    for (const it of j.items ?? []) {
      const id = it.id?.videoId;
      if (!id || exclude.has(id)) continue;
      exclude.add(id);
      out.push(it);
      if (out.length >= want) break;
    }
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  return out;
}

async function refreshChannel(
  channelDbId: string,
  ytChannelId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractLocations: (args: { data: { video_id: string } }) => Promise<any>,
): Promise<number> {
  const seen = new Set<string>();
  const latest = await fetchN(ytChannelId, "date", 20, seen);
  const top = await fetchN(ytChannelId, "viewCount", 20, seen);
  const all = [...latest, ...top];
  if (all.length === 0) return 0;

  const ids = all.map((v) => v.id.videoId);
  const statsRes = await ytFetch(
    (key) =>
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.join(",")}&key=${key}`,
  );
  const statsJson = (await statsRes.json()) as {
    items?: Array<{ id: string; statistics: { viewCount?: string; likeCount?: string } }>;

  };
  const stats = new Map(statsJson.items?.map((i) => [i.id, i.statistics]) ?? []);

  const { data: existing } = await db
    .from("videos")
    .select("id, youtube_video_id")
    .eq("channel_id", channelDbId);
  const existingMap = new Map<string, string>(
    ((existing ?? []) as Array<{ id: string; youtube_video_id: string }>).map((r) => [
      r.youtube_video_id,
      r.id,
    ]),
  );

  const newDbIds: string[] = [];
  for (const v of all) {
    const s = stats.get(v.id.videoId);
    const wasNew = !existingMap.has(v.id.videoId);
    const { data: row } = await db
      .from("videos")
      .upsert(
        {
          youtube_video_id: v.id.videoId,
          channel_id: channelDbId,
          title: v.snippet.title,
          description: v.snippet.description,
          thumbnail_url: v.snippet.thumbnails?.high?.url,
          published_at: v.snippet.publishedAt,
          view_count: s?.viewCount ? Number(s.viewCount) : 0,
          like_count: s?.likeCount ? Number(s.likeCount) : 0,
        },
        { onConflict: "youtube_video_id" },
      )
      .select("id")
      .single();
    if (row && wasNew) newDbIds.push(row.id);
  }

  await Promise.allSettled(
    newDbIds.map((id) => extractLocations({ data: { video_id: id } })),
  );

  // Select the FINAL set among candidates that actually have extracted
  // locations (pins): latest 20 + top-viewed 5, deduped.
  const finalKeepIds = await selectFinalVideoIds(db, channelDbId, ids);

  // Stale trim: drop any existing video NOT in the final keep set,
  // preserving favorites/collections.
  const staleIds = (
    (existing ?? []) as Array<{ id: string; youtube_video_id: string }>
  )
    .filter((r) => !finalKeepIds.has(r.id))
    .map((r) => r.id);
  if (staleIds.length > 0) {
    const [{ data: favRefs }, { data: colRefs }] = await Promise.all([
      db.from("favorites").select("video_id").in("video_id", staleIds),
      db.from("collection_items").select("video_id").in("video_id", staleIds),
    ]);
    const keep = new Set<string>([
      ...((favRefs ?? []) as Array<{ video_id: string | null }>)
        .map((r) => r.video_id)
        .filter((v): v is string => Boolean(v)),
      ...((colRefs ?? []) as Array<{ video_id: string | null }>)
        .map((r) => r.video_id)
        .filter((v): v is string => Boolean(v)),
    ]);
    const toDelete = staleIds.filter((id) => !keep.has(id));
    if (toDelete.length > 0) {
      await db.from("videos").delete().in("id", toDelete);
    }
  }

  return newDbIds.length;
}

/**
 * Among the candidate YouTube video IDs for a channel, picks the final set
 * we want to surface as map pins: the 20 most recently published + the 5
 * most viewed, restricted to videos that have at least one extracted pin.
 */
export async function selectFinalVideoIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  channelDbId: string,
  candidateYtIds: string[],
): Promise<Set<string>> {
  if (candidateYtIds.length === 0) return new Set();
  const { data: rows } = await db
    .from("videos")
    .select("id, view_count, published_at")
    .eq("channel_id", channelDbId)
    .in("youtube_video_id", candidateYtIds);
  const candidates =
    (rows ?? []) as Array<{ id: string; view_count: number | null; published_at: string | null }>;
  if (candidates.length === 0) return new Set();

  const { data: pinRows } = await db
    .from("pins")
    .select("video_id")
    .in("video_id", candidates.map((r) => r.id));
  const hasPin = new Set(
    ((pinRows ?? []) as Array<{ video_id: string | null }>)
      .map((r) => r.video_id)
      .filter((v): v is string => Boolean(v)),
  );

  const withPins = candidates.filter((r) => hasPin.has(r.id));
  const latest = [...withPins]
    .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))
    .slice(0, 20);
  const top = [...withPins]
    .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
    .slice(0, 5);
  return new Set<string>([...latest, ...top].map((r) => r.id));
}

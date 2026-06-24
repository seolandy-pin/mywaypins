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
  apiKey: string,
): Promise<SearchItem[]> {
  const out: SearchItem[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3 && out.length < want; page++) {
    const url =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}` +
      `&maxResults=50&order=${order}&type=video&key=${apiKey}` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const r = await fetch(url);
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
  YT_KEY: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractLocations: (args: { data: { video_id: string } }) => Promise<any>,
): Promise<number> {
  const seen = new Set<string>();
  const latest = await fetchN(ytChannelId, "date", 20, seen, YT_KEY);
  const top = await fetchN(ytChannelId, "viewCount", 20, seen, YT_KEY);
  const all = [...latest, ...top];
  if (all.length === 0) return 0;

  const ids = all.map((v) => v.id.videoId);
  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.join(",")}&key=${YT_KEY}`,
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

  const currentYt = new Set(ids);
  const staleIds = (
    (existing ?? []) as Array<{ id: string; youtube_video_id: string }>
  )
    .filter((r) => !currentYt.has(r.youtube_video_id))
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

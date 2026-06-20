import { createFileRoute } from "@tanstack/react-router";
import { extractLocations } from "@/lib/api/channels.functions";

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

export const Route = createFileRoute("/api/public/hooks/refresh-followed")({
  server: {
    handlers: {
      POST: async () => {
        const YT_KEY = process.env.YOUTUBE_API_KEY;
        if (!YT_KEY) {
          return new Response(JSON.stringify({ ok: false, reason: "YOUTUBE_API_KEY missing" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Channels with at least one follower
        const { data: followRows } = await supabaseAdmin.from("followers").select("channel_id");
        const channelIds = Array.from(
          new Set(((followRows ?? []).map((r) => r.channel_id).filter(Boolean)) as string[]),
        );
        if (channelIds.length === 0) {
          return Response.json({ ok: true, channels: 0, newVideos: 0 });
        }

        const { data: channels } = await supabaseAdmin
          .from("youtube_channels")
          .select("id, youtube_channel_id, name")
          .in("id", channelIds);

        const { sendFcmToTokens } = await import("@/lib/server/fcm-send.server");

        let totalNew = 0;
        let totalPushed = 0;
        for (const ch of channels ?? []) {
          if (!ch.youtube_channel_id) continue;
          try {
            const newOnes = await refreshChannel(
              ch.id,
              ch.youtube_channel_id,
              YT_KEY,
              supabaseAdmin,
            );
            totalNew += newOnes.length;
            if (newOnes.length === 0) continue;

            // Pick the newest of this batch as the notification subject.
            const latest = newOnes
              .slice()
              .sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""))[0];

            // Followers of this channel → their FCM tokens.
            const { data: follows } = await supabaseAdmin
              .from("followers")
              .select("user_id")
              .eq("channel_id", ch.id);
            const userIds = Array.from(
              new Set((follows ?? []).map((f) => f.user_id).filter(Boolean)),
            );
            if (userIds.length === 0) continue;

            const { data: tokRows } = await supabaseAdmin
              .from("fcm_tokens")
              .select("token")
              .in("user_id", userIds);
            const tokens = (tokRows ?? []).map((r) => r.token).filter(Boolean);

            // Persist in-app notifications so the bell stays populated.
            const link = `/channel/${ch.id}`;
            await supabaseAdmin.from("notifications").insert(
              userIds.map((uid) => ({
                user_id: uid,
                kind: "new_video",
                title: `${ch.name ?? "채널"}에 새 영상`,
                body: latest.title,
                link,
              })),
            );

            if (tokens.length > 0) {
              const res = await sendFcmToTokens(tokens, {
                title: `${ch.name ?? "채널"}에 새 영상`,
                body: latest.title,
                url: link,
                tag: `ch:${ch.id}`,
              });
              totalPushed += res.sent;
              if (res.invalidTokens.length > 0) {
                await supabaseAdmin
                  .from("fcm_tokens")
                  .delete()
                  .in("token", res.invalidTokens);
              }
            }
          } catch (e) {
            console.error("[refresh-followed] channel failed", ch.id, e);
          }
        }
        return Response.json({
          ok: true,
          channels: channels?.length ?? 0,
          newVideos: totalNew,
          pushed: totalPushed,
        });
      },
    },
  },
});

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

type NewVideo = { id: string; title: string; published_at: string };

async function refreshChannel(
  channelDbId: string,
  ytChannelId: string,
  YT_KEY: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
): Promise<NewVideo[]> {
  const seen = new Set<string>();
  const latest = await fetchN(ytChannelId, "date", 20, seen, YT_KEY);
  const top = await fetchN(ytChannelId, "viewCount", 20, seen, YT_KEY);
  const all = [...latest, ...top];
  if (all.length === 0) return [];

  // Fetch view stats (search endpoint doesn't include them)
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

  const newVideos: NewVideo[] = [];
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
    if (row && wasNew) {
      newDbIds.push(row.id);
      newVideos.push({
        id: row.id,
        title: v.snippet.title,
        published_at: v.snippet.publishedAt,
      });
    }
  }

  // Extract locations for newly-discovered videos
  await Promise.allSettled(
    newDbIds.map((id) => extractLocations({ data: { video_id: id } })),
  );

  // Trim: drop videos no longer in latest-20 + top-20, but preserve any the
  // user has favorited or saved to a collection.
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

  return newVideos;
}

import { createFileRoute } from "@tanstack/react-router";
import { extractLocations } from "@/lib/api/channels.functions";
import { hasYouTubeKey, ytFetch } from "@/lib/youtube-keys";


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
        if (!hasYouTubeKey()) {
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
                title: `New video on ${ch.name ?? "Channel"}`,
                body: latest.title,
                link,
              })),
            );

            if (tokens.length > 0) {
              const res = await sendFcmToTokens(tokens, {
                title: `New video on ${ch.name ?? "Channel"}`,
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

type NewVideo = { id: string; title: string; published_at: string };

async function refreshChannel(
  channelDbId: string,
  ytChannelId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
): Promise<NewVideo[]> {
  const seen = new Set<string>();
  const latest = await fetchN(ytChannelId, "date", 20, seen);
  const top = await fetchN(ytChannelId, "viewCount", 20, seen);
  const all = [...latest, ...top];
  if (all.length === 0) return [];

  // Fetch view stats (search endpoint doesn't include them)
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

  // Final selection: latest 20 + top-viewed 5 among candidates that ended
  // up with at least one extracted pin.
  const { selectFinalVideoIds } = await import("@/lib/api/refresh.functions");
  const finalKeepIds = await selectFinalVideoIds(db, channelDbId, ids);

  // Trim: drop existing videos NOT in the final keep set, preserving
  // favorites/collections.
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

  // Only announce "new videos" that survived the final selection.
  return newVideos.filter((v) => finalKeepIds.has(v.id));
}

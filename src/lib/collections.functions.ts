import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { extractLocations } from "@/lib/api/channels.functions";

function parseYoutubeVideoId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace(/^\//, "").split("/")[0] || null;
    }
    const v = u.searchParams.get("v");
    if (v) return v;
    const m = u.pathname.match(/\/(shorts|embed|live)\/([^/?#]+)/);
    if (m) return m[2];
    return null;
  } catch {
    return null;
  }
}

export const listMyCollections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: cols, error } = await supabase
      .from("collections")
      .select("id, name, cover_image_url, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!cols || cols.length === 0) return [];

    const ids = cols.map((c) => c.id);
    const { data: items } = await supabase
      .from("collection_items")
      .select("collection_id, video_id, videos(thumbnail_url)")
      .in("collection_id", ids);

    const byCol = new Map<string, { videoIds: string[]; cover: string | null }>();
    for (const c of cols) byCol.set(c.id, { videoIds: [], cover: c.cover_image_url });
    for (const it of items ?? []) {
      const bucket = byCol.get(it.collection_id as string);
      if (!bucket) continue;
      if (it.video_id) bucket.videoIds.push(it.video_id as string);
      const thumb = (it as { videos: { thumbnail_url?: string } | null }).videos?.thumbnail_url;
      if (!bucket.cover && thumb) bucket.cover = thumb;
    }
    return cols.map((c) => ({
      id: c.id,
      name: c.name,
      cover_image_url: byCol.get(c.id)?.cover ?? null,
      video_ids: byCol.get(c.id)?.videoIds ?? [],
      item_count: byCol.get(c.id)?.videoIds.length ?? 0,
    }));
  });

export const createCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("collections")
      .insert({ user_id: userId, name: data.name, is_public: false })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("collections")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveVideoToCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      videoUrl: z.string().url().max(500),
      collectionId: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify collection ownership.
    const { data: col } = await supabase
      .from("collections")
      .select("id")
      .eq("id", data.collectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!col) throw new Error("Collection not found");

    const videoId = parseYoutubeVideoId(data.videoUrl);
    if (!videoId) throw new Error("Could not parse a YouTube video ID from that URL");

    const YT_KEY = process.env.YOUTUBE_API_KEY;
    if (!YT_KEY) throw new Error("YOUTUBE_API_KEY not configured");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch video metadata.
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${YT_KEY}`,
    );
    const j = (await r.json()) as {
      items?: Array<{
        id: string;
        snippet: { title: string; description: string; publishedAt: string; channelId: string; channelTitle: string; thumbnails: { high?: { url: string }; medium?: { url: string } } };
        statistics?: { viewCount?: string; likeCount?: string };
      }>;
    };
    const v = j.items?.[0];
    if (!v) throw new Error("Video not found on YouTube");

    // Best-effort: link to channel row if it already exists (we don't auto-create
    // a channel here — the user said this flow saves individual videos only).
    const { data: existingChannel } = await supabaseAdmin
      .from("youtube_channels")
      .select("id")
      .eq("youtube_channel_id", v.snippet.channelId)
      .maybeSingle();

    const { data: vidRow, error: vidErr } = await supabaseAdmin
      .from("videos")
      .upsert(
        {
          youtube_video_id: v.id,
          channel_id: existingChannel?.id ?? null,
          title: v.snippet.title,
          description: v.snippet.description,
          thumbnail_url: v.snippet.thumbnails?.high?.url ?? v.snippet.thumbnails?.medium?.url ?? null,
          published_at: v.snippet.publishedAt,
          view_count: Number(v.statistics?.viewCount ?? 0),
          like_count: Number(v.statistics?.likeCount ?? 0),
        },
        { onConflict: "youtube_video_id" },
      )
      .select("id, ai_processed")
      .single();
    if (vidErr || !vidRow) throw new Error(vidErr?.message ?? "Failed to save video");

    // Extract pins via AI (idempotent — extractLocations dedupes by label).
    let pinsCount = 0;
    try {
      const result = await extractLocations({ data: { video_id: vidRow.id } });
      pinsCount = result?.pins ?? 0;
    } catch (e) {
      console.error("extractLocations failed:", e);
    }

    // Add to collection (ignore duplicate).
    const { error: insertErr } = await supabase
      .from("collection_items")
      .insert({ collection_id: data.collectionId, video_id: vidRow.id });
    if (insertErr && insertErr.code !== "23505") throw new Error(insertErr.message);

    return { ok: true, videoId: vidRow.id, pins: pinsCount };
  });

export const removeCollectionItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ collectionId: z.string().uuid(), videoId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: col } = await supabase
      .from("collections").select("id").eq("id", data.collectionId).eq("user_id", userId).maybeSingle();
    if (!col) throw new Error("Collection not found");
    const { error } = await supabase
      .from("collection_items")
      .delete()
      .eq("collection_id", data.collectionId)
      .eq("video_id", data.videoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

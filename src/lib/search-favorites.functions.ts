import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SaveInput = {
  youtubeVideoId: string;
  title: string;
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
  viewCount?: number | null;
  // channel info (optional but recommended so we can link the row)
  youtubeChannelId?: string | null;
  channelName?: string | null;
  channelThumbnailUrl?: string | null;
  channelUrl?: string | null;
};

async function ensureVideoRow(input: SaveInput): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Ensure channel row (if we have a channel id)
  let channelUuid: string | null = null;
  if (input.youtubeChannelId) {
    const { data: existing } = await supabaseAdmin
      .from("youtube_channels")
      .select("id")
      .eq("youtube_channel_id", input.youtubeChannelId)
      .maybeSingle();
    if (existing) {
      channelUuid = existing.id;
    } else {
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("youtube_channels")
        .insert({
          youtube_channel_id: input.youtubeChannelId,
          name: input.channelName ?? "Unknown",
          thumbnail_url: input.channelThumbnailUrl ?? null,
          channel_url: input.channelUrl ?? null,
        })
        .select("id")
        .single();
      if (insErr && insErr.code !== "23505") throw insErr;
      if (inserted) {
        channelUuid = inserted.id;
      } else {
        const { data: raced } = await supabaseAdmin
          .from("youtube_channels")
          .select("id")
          .eq("youtube_channel_id", input.youtubeChannelId)
          .single();
        channelUuid = raced?.id ?? null;
      }
    }
  }

  // 2. Ensure video row
  const { data: existingVideo } = await supabaseAdmin
    .from("videos")
    .select("id")
    .eq("youtube_video_id", input.youtubeVideoId)
    .maybeSingle();
  if (existingVideo) return existingVideo.id;

  const { data: insertedVid, error: vidErr } = await supabaseAdmin
    .from("videos")
    .insert({
      youtube_video_id: input.youtubeVideoId,
      title: input.title,
      thumbnail_url: input.thumbnailUrl ?? null,
      published_at: input.publishedAt ?? null,
      view_count: input.viewCount ?? null,
      channel_id: channelUuid,
    })
    .select("id")
    .single();
  if (vidErr) {
    if (vidErr.code !== "23505") throw vidErr;
    const { data: raced } = await supabaseAdmin
      .from("videos")
      .select("id")
      .eq("youtube_video_id", input.youtubeVideoId)
      .single();
    return raced!.id;
  }
  return insertedVid!.id;
}

export const saveSearchVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SaveInput) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const videoUuid = await ensureVideoRow(data);
    const { error } = await supabase
      .from("favorites")
      .insert({ user_id: userId, target_type: "video", video_id: videoUuid });
    if (error && error.code !== "23505") throw error;
    return { saved: true, videoId: videoUuid };
  });

export const unsaveSearchVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { youtubeVideoId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: v } = await supabase
      .from("videos")
      .select("id")
      .eq("youtube_video_id", data.youtubeVideoId)
      .maybeSingle();
    if (!v) return { saved: false };
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("target_type", "video")
      .eq("video_id", v.id);
    if (error) throw error;
    return { saved: false };
  });

export const getSearchVideoSavedStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { youtubeVideoId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: v } = await supabase
      .from("videos")
      .select("id")
      .eq("youtube_video_id", data.youtubeVideoId)
      .maybeSingle();
    if (!v) return { saved: false };
    const { data: f } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", userId)
      .eq("target_type", "video")
      .eq("video_id", v.id)
      .maybeSingle();
    return { saved: Boolean(f) };
  });

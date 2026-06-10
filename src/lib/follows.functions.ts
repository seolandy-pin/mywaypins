import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { processSubmission } from "@/lib/api/channels.functions";

type ChannelInput = {
  youtubeChannelId: string;
  name: string;
  thumbnailUrl?: string | null;
  channelUrl?: string | null;
};

export const followChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ChannelInput) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ch, error: upsertErr } = await supabase
      .from("youtube_channels")
      .upsert(
        {
          youtube_channel_id: data.youtubeChannelId,
          name: data.name,
          thumbnail_url: data.thumbnailUrl ?? null,
          channel_url: data.channelUrl ?? null,
        },
        { onConflict: "youtube_channel_id" },
      )
      .select("id, video_count")
      .single();
    if (upsertErr) throw upsertErr;

    const { error: followErr } = await supabase
      .from("followers")
      .insert({ user_id: userId, channel_id: ch.id });
    if (followErr && followErr.code !== "23505") throw followErr;

    // Auto-ingest: if channel has no videos yet, kick off the same pipeline as Submit.
    let ingestionStarted = false;
    if (!ch.video_count && data.channelUrl) {
      try {
        const { data: sub, error: subErr } = await supabase
          .from("submitted_channels")
          .insert({
            submitted_by: userId,
            channel_url: data.channelUrl,
            channel_name: data.name,
          })
          .select("id")
          .single();
        if (!subErr && sub) {
          ingestionStarted = true;
          // Fire-and-forget; client doesn't wait for AI extraction.
          processSubmission({ data: { submission_id: sub.id } }).catch((e) =>
            console.error("Auto-ingest failed:", e),
          );
        }
      } catch (e) {
        console.error("Auto-ingest kickoff failed:", e);
      }
    }
    return { channelId: ch.id, following: true, ingestionStarted };
  });


export const unfollowChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { youtubeChannelId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ch } = await supabase
      .from("youtube_channels")
      .select("id")
      .eq("youtube_channel_id", data.youtubeChannelId)
      .maybeSingle();
    if (!ch) return { following: false };
    const { error } = await supabase
      .from("followers")
      .delete()
      .eq("user_id", userId)
      .eq("channel_id", ch.id);
    if (error) throw error;
    return { following: false };
  });

export const getFollowStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { youtubeChannelId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ch } = await supabase
      .from("youtube_channels")
      .select("id")
      .eq("youtube_channel_id", data.youtubeChannelId)
      .maybeSingle();
    if (!ch) return { following: false };
    const { data: f } = await supabase
      .from("followers")
      .select("id")
      .eq("user_id", userId)
      .eq("channel_id", ch.id)
      .maybeSingle();
    return { following: Boolean(f) };
  });

export const listMyFollowedChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("followers")
      .select("created_at, youtube_channels(id, youtube_channel_id, name, thumbnail_url, subscriber_count, current_location, is_currently_traveling)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

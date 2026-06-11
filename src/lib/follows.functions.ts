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
    let ch: { id: string; video_count: number | null } | null = null;

    const { data: existingChannel, error: selectErr } = await supabase
      .from("youtube_channels")
      .select("id, video_count")
      .eq("youtube_channel_id", data.youtubeChannelId)
      .maybeSingle();
    if (selectErr) throw selectErr;

    if (existingChannel) {
      ch = existingChannel;
    } else {
      const { data: insertedChannel, error: insertErr } = await supabase
      .from("youtube_channels")
        .insert({
          youtube_channel_id: data.youtubeChannelId,
          name: data.name,
          thumbnail_url: data.thumbnailUrl ?? null,
          channel_url: data.channelUrl ?? null,
        })
      .select("id, video_count")
      .single();
      if (insertErr) {
        if (insertErr.code !== "23505") throw insertErr;

        const { data: racedChannel, error: racedErr } = await supabase
          .from("youtube_channels")
          .select("id, video_count")
          .eq("youtube_channel_id", data.youtubeChannelId)
          .single();
        if (racedErr) throw racedErr;
        ch = racedChannel;
      } else {
        ch = insertedChannel;
      }
    }

    if (!ch) throw new Error("Unable to find or create channel");

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
          // Await so ingestion runs to completion before the request returns —
          // Cloudflare Workers cancel pending promises after the response is sent.
          try {
            await processSubmission({ data: { submission_id: sub.id } });
          } catch (e) {
            console.error("Auto-ingest failed:", e);
          }
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

// Process any pending submissions belonging to the current user. Used to
// recover from fire-and-forget ingestion that got cancelled by the worker
// when the original follow request returned.
export const processMyPendingSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: pending } = await supabase
      .from("submitted_channels")
      .select("id")
      .eq("submitted_by", userId)
      .eq("status", "pending")
      .limit(5);
    if (!pending || pending.length === 0) return { processed: 0 };
    let processed = 0;
    for (const row of pending) {
      try {
        await processSubmission({ data: { submission_id: row.id } });
        processed++;
      } catch (e) {
        console.error("processMyPendingSubmissions failed", row.id, e);
      }
    }
    return { processed };
  });

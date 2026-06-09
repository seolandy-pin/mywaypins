import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SubmitInput = z.object({
  channel_url: z.string().url().max(500),
  channel_name: z.string().trim().min(1).max(200).optional(),
});

// Submit a channel for processing. Stored in queue; ingestion is async.
export const submitChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubmitInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error, data: row } = await supabase
      .from("submitted_channels")
      .insert({ submitted_by: userId, channel_url: data.channel_url, channel_name: data.channel_name })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Kick off ingestion (best-effort, non-blocking failure)
    try {
      await processSubmission({ data: { submission_id: row.id } });
    } catch (e) {
      console.error("Ingestion kickoff failed:", e);
    }
    return { ok: true, id: row.id };
  });

const ProcessInput = z.object({ submission_id: z.string().uuid() });

// Process a submission: fetch channel info from YouTube, store, queue videos for AI location extraction.
export const processSubmission = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ProcessInput.parse(input))
  .handler(async ({ data }) => {
    const YT_KEY = process.env.YOUTUBE_API_KEY;
    if (!YT_KEY) {
      return { ok: false, reason: "YOUTUBE_API_KEY not configured — submission stored for later processing." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sub } = await supabaseAdmin
      .from("submitted_channels")
      .select("*")
      .eq("id", data.submission_id)
      .maybeSingle();
    if (!sub) throw new Error("Submission not found");

    // Resolve channel ID from URL (supports /channel/ID, /@handle, /c/name).
    const channelId = await resolveYoutubeChannelId(sub.channel_url, YT_KEY);
    if (!channelId) throw new Error("Could not resolve YouTube channel from URL");

    // Fetch channel details
    const chRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${YT_KEY}`,
    );
    const chJson = (await chRes.json()) as {
      items?: Array<{
        id: string;
        snippet: { title: string; description: string; thumbnails: { high?: { url: string } } };
        statistics: { subscriberCount?: string; videoCount?: string };
      }>;
    };
    const ch = chJson.items?.[0];
    if (!ch) throw new Error("Channel not found on YouTube");

    const { data: chRow } = await supabaseAdmin
      .from("youtube_channels")
      .upsert(
        {
          youtube_channel_id: ch.id,
          channel_url: sub.channel_url,
          name: ch.snippet.title,
          description: ch.snippet.description,
          thumbnail_url: ch.snippet.thumbnails?.high?.url,
          subscriber_count: Number(ch.statistics.subscriberCount ?? 0),
          video_count: Number(ch.statistics.videoCount ?? 0),
        },
        { onConflict: "youtube_channel_id" },
      )
      .select()
      .single();

    await supabaseAdmin
      .from("submitted_channels")
      .update({ status: "processed", resolved_channel_id: chRow!.id })
      .eq("id", sub.id);

    // Fetch latest videos and store (limit 10 for MVP)
    const vidsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${ch.id}&maxResults=10&order=date&type=video&key=${YT_KEY}`,
    );
    const vidsJson = (await vidsRes.json()) as {
      items?: Array<{
        id: { videoId: string };
        snippet: { title: string; description: string; publishedAt: string; thumbnails: { high?: { url: string } } };
      }>;
    };

    for (const v of vidsJson.items ?? []) {
      const { data: vidRow } = await supabaseAdmin
        .from("videos")
        .upsert(
          {
            youtube_video_id: v.id.videoId,
            channel_id: chRow!.id,
            title: v.snippet.title,
            description: v.snippet.description,
            thumbnail_url: v.snippet.thumbnails?.high?.url,
            published_at: v.snippet.publishedAt,
          },
          { onConflict: "youtube_video_id" },
        )
        .select()
        .single();
      if (vidRow) {
        // Fire-and-forget AI extraction
        extractLocations({ data: { video_id: vidRow.id } }).catch((e) => console.error("AI extract failed:", e));
      }
    }

    return { ok: true, channel_id: chRow!.id, videos: vidsJson.items?.length ?? 0 };
  });

const ExtractInput = z.object({ video_id: z.string().uuid() });

export const extractLocations = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data }) => {
    const KEY = process.env.LOVABLE_API_KEY;
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: video } = await supabaseAdmin
      .from("videos")
      .select("id, title, description, channel_id")
      .eq("id", data.video_id)
      .maybeSingle();
    if (!video) throw new Error("Video not found");

    const prompt = `Extract travel locations from this YouTube travel video. Return JSON with shape: { "locations": [ { "name": "...", "city": "...", "country": "...", "latitude": <num>, "longitude": <num> } ] }. Only include real, specific locations the video is about. If none, return empty array.\n\nTitle: ${video.title}\n\nDescription: ${(video.description ?? "").slice(0, 2000)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": KEY },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`AI gateway ${res.status}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { locations?: Array<{ name: string; city?: string; country?: string; latitude: number; longitude: number }> } = {};
    try { parsed = JSON.parse(text); } catch {}

    const locs = parsed.locations ?? [];
    for (let i = 0; i < locs.length; i++) {
      const l = locs[i];
      if (typeof l.latitude !== "number" || typeof l.longitude !== "number") continue;
      const { data: place } = await supabaseAdmin
        .from("places")
        .insert({
          name: l.name,
          kind: "landmark",
          city_name: l.city,
          country_name: l.country,
          latitude: l.latitude,
          longitude: l.longitude,
        })
        .select()
        .single();
      await supabaseAdmin.from("pins").insert({
        video_id: video.id,
        channel_id: video.channel_id,
        place_id: place?.id,
        latitude: l.latitude,
        longitude: l.longitude,
        label: l.name,
        pin_type: "new",
        sequence_order: i,
      });
    }

    await supabaseAdmin.from("videos").update({ ai_processed: true }).eq("id", video.id);
    return { ok: true, pins: locs.length };
  });

async function resolveYoutubeChannelId(url: string, apiKey: string): Promise<string | null> {
  const channelMatch = url.match(/\/channel\/([A-Za-z0-9_-]+)/);
  if (channelMatch) return channelMatch[1];
  const handleMatch = url.match(/\/@([A-Za-z0-9_.-]+)/);
  const customMatch = url.match(/\/c\/([A-Za-z0-9_.-]+)/);
  const query = handleMatch?.[1] ?? customMatch?.[1];
  if (!query) return null;
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=1&key=${apiKey}`,
  );
  const json = (await res.json()) as { items?: Array<{ snippet?: { channelId?: string } }> };
  return json.items?.[0]?.snippet?.channelId ?? null;
}

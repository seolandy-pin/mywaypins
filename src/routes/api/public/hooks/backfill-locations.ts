import { createFileRoute } from "@tanstack/react-router";
import { extractLocations } from "@/lib/api/channels.functions";

// Safety net: periodically finds videos with ai_processed = false and runs
// extractLocations against them. Guarantees pins eventually exist for every
// ingested video even if the inline AI call during follow/ingest failed.
//
// Designed to be invoked by pg_cron every few minutes. Bounded per call to
// keep gateway usage predictable; remaining videos process on next tick.
const BATCH_SIZE = 15;

export const Route = createFileRoute("/api/public/hooks/backfill-locations")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: videos, error } = await supabaseAdmin
          .from("videos")
          .select("id")
          .eq("ai_processed", false)
          .order("published_at", { ascending: false })
          .limit(BATCH_SIZE);

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        if (!videos || videos.length === 0) {
          return Response.json({ ok: true, processed: 0, failed: 0, remaining: 0 });
        }

        let processed = 0;
        let failed = 0;
        for (const v of videos) {
          try {
            await extractLocations({ data: { video_id: v.id } });
            processed++;
          } catch (e) {
            failed++;
            console.error("[backfill-locations] failed", v.id, e);
          }
        }

        const { count: remaining } = await supabaseAdmin
          .from("videos")
          .select("id", { count: "exact", head: true })
          .eq("ai_processed", false);

        return Response.json({ ok: true, processed, failed, remaining: remaining ?? 0 });
      },
    },
  },
});

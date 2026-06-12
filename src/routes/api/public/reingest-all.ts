import { createFileRoute } from "@tanstack/react-router";
import { processSubmission } from "@/lib/api/channels.functions";

export const Route = createFileRoute("/api/public/reingest-all")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: subs } = await supabaseAdmin
          .from("submitted_channels")
          .select("id, resolved_channel_id, created_at")
          .not("resolved_channel_id", "is", null)
          .order("created_at", { ascending: false });
        const seen = new Set<string>();
        const unique: string[] = [];
        for (const s of subs ?? []) {
          if (seen.has(s.resolved_channel_id!)) continue;
          seen.add(s.resolved_channel_id!);
          unique.push(s.id);
        }
        const results: Array<{ id: string; ok: boolean; videos?: number; pins?: number; error?: string }> = [];
        for (const id of unique) {
          try {
            const r = await processSubmission({ data: { submission_id: id } });
            results.push({ id, ok: true, videos: r.videos, pins: r.pins });
          } catch (e) {
            results.push({ id, ok: false, error: (e as Error).message });
          }
        }
        return new Response(JSON.stringify({ count: unique.length, results }, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

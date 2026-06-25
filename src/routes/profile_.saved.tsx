import { createFileRoute, Link } from "@tanstack/react-router";

import { useAuth } from "@/lib/auth/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Bookmark, ChevronLeft, MapPin, Trash2 } from "lucide-react";
import { VideoSheet } from "@/components/VideoSheet";
import type { SamplePin } from "@/lib/sample-data";
import { PIN_TYPE_COLORS } from "@/lib/sample-data";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/profile_/saved")({
  head: () => ({ meta: [{ title: "Saved — WanderPins" }] }),
  component: SavedScreen,
});

type VideoRow = {
  id?: string;
  youtube_video_id: string | null;
  title: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  view_count: number | null;
  youtube_channels: { name: string | null } | null;
};

type FavoriteRow = {
  id: string;
  pin_id: string | null;
  video_id: string | null;
  target_type: string;
  created_at: string;
  pins: {
    id: string;
    latitude: number | null;
    longitude: number | null;
    label: string | null;
    pin_type: string | null;
    videos: VideoRow | null;
    places: { city_name: string | null; country_name: string | null } | null;
  } | null;
  videos: VideoRow | null;
};

function rowToPin(r: FavoriteRow): SamplePin | null {
  // Pin-backed favorite (existing behaviour)
  if (r.target_type === "pin" && r.pins) {
    const p = r.pins;
    const v = p.videos;
    const place = p.places;
    const allowed = ["trending", "new", "featured", "traveling"];
    const type = (allowed.includes(p.pin_type ?? "") ? p.pin_type : "new") as SamplePin["type"];
    return {
      id: p.id,
      lat: p.latitude ?? 0,
      lng: p.longitude ?? 0,
      type,
      title: v?.title ?? p.label ?? "Untitled",
      creator: v?.youtube_channels?.name ?? "Unknown",
      thumbnail: v?.thumbnail_url ?? "",
      location: [place?.city_name, place?.country_name].filter(Boolean).join(", ") || (p.label ?? ""),
      views: "",
      uploaded: v?.published_at ? new Date(v.published_at).toLocaleDateString() : "",
      youtubeId: v?.youtube_video_id ?? "",
    };
  }
  // Video-only favorite (saved from search results)
  if (r.target_type === "video" && r.videos) {
    const v = r.videos;
    return {
      id: r.id,
      lat: 0,
      lng: 0,
      type: "new",
      title: v.title ?? "Untitled",
      creator: v.youtube_channels?.name ?? "Unknown",
      thumbnail: v.thumbnail_url ?? "",
      location: "",
      views: "",
      uploaded: v.published_at ? new Date(v.published_at).toLocaleDateString() : "",
      youtubeId: v.youtube_video_id ?? "",
    };
  }
  return null;
}

function SavedScreen() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<SamplePin | null>(null);
  const [open, setOpen] = useState(false);
  const [viewedVideoIds, setViewedVideoIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("favorites")
      .select(
        "id, pin_id, video_id, target_type, created_at, pins(id, latitude, longitude, label, pin_type, videos(youtube_video_id, title, thumbnail_url, published_at, view_count, youtube_channels(name)), places(city_name, country_name)), videos(youtube_video_id, title, thumbnail_url, published_at, view_count, youtube_channels(name))",
      )
      .eq("user_id", user.id)
      .in("target_type", ["pin", "video"])
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setRows((data ?? []) as unknown as FavoriteRow[]);
        setLoading(false);
      });
    supabase
      .from("dismissed_notifications")
      .select("video_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setViewedVideoIds(new Set((data ?? []).map((r) => r.video_id)));
      });
  }, [user]);

  async function markViewed(r: FavoriteRow) {
    if (!user) return;
    const videoUuid = r.target_type === "video" ? r.video_id : r.pins?.videos ? (r.pins as unknown as { videos: { id?: string } | null }).videos?.id : null;
    // pins.videos shape doesn't include id in our select; fall back to video_id field for video favorites only.
    const vid = r.target_type === "video" ? r.video_id : null;
    if (!vid || viewedVideoIds.has(vid)) return;
    setViewedVideoIds((s) => {
      const n = new Set(s);
      n.add(vid);
      return n;
    });
    await supabase
      .from("dismissed_notifications")
      .upsert({ user_id: user.id, video_id: vid }, { onConflict: "user_id,video_id" });
    void videoUuid;
  }

  async function remove(id: string) {
    const { error } = await supabase.from("favorites").delete().eq("id", id);
    if (error) {
      toast.error("Couldn't remove");
      return;
    }
    setRows((r) => r.filter((x) => x.id !== id));
    toast.success("Removed");
  }

  return (
    <>
      <header className="safe-top flex items-center gap-2 px-5 pt-4">
        <Link to="/profile" className="rounded-full p-1 active:bg-surface-1"><ChevronLeft className="size-5" /></Link>
        <h1 className="font-display text-xl font-bold">Saved</h1>
      </header>

      {authLoading ? (
        <div className="p-6 text-sm text-muted-foreground">Loading…</div>
      ) : !isAuthenticated ? (
        <div className="safe-top flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="rounded-full bg-surface-2 p-4"><Bookmark className="size-8 text-primary" /></div>
          <h2 className="font-display text-2xl font-bold">Your saved places</h2>
          <p className="text-sm text-muted-foreground text-balance">
            Sign in to save places, build travel collections, and follow creators.
          </p>
          <Button asChild size="lg" className="mt-2"><Link to="/auth">Sign in or create account</Link></Button>
        </div>
      ) : loading ? (
        <div className="p-6 text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-6 text-center">
          <Bookmark className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nothing saved yet. Tap the bookmark on any video.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 px-5 py-4">
          {rows.map((r) => {
            const pin = rowToPin(r);
            if (!pin) return null;
            return (
              <li key={r.id} className="overflow-hidden rounded-2xl bg-card border border-border">
                <button
                  onClick={() => { setActive(pin); setOpen(true); }}
                  className="flex w-full gap-3 text-left active:bg-surface-1"
                >
                  <div className="relative size-24 shrink-0 bg-black">
                    {pin.thumbnail ? (
                      <img src={pin.thumbnail} alt="" className="size-full object-cover" />
                    ) : null}
                    <span
                      className="absolute left-1 top-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                      style={{ background: PIN_TYPE_COLORS[pin.type] }}
                    >
                      {pin.type}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 py-2 pr-2">
                    <p className="line-clamp-2 text-sm font-medium">{pin.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{pin.creator}</p>
                    <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="size-3" /> {pin.location || "—"}
                    </p>
                  </div>
                </button>
                <div className="flex justify-end border-t border-border px-2 py-1">
                  <button
                    onClick={() => remove(r.id)}
                    className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground active:bg-surface-1"
                  >
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <VideoSheet pin={active} open={open} onOpenChange={setOpen} />
    </>
  );
}

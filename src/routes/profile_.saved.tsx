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

type FavoriteRow = {
  id: string;
  pin_id: string | null;
  created_at: string;
  pins: {
    id: string;
    latitude: number | null;
    longitude: number | null;
    label: string | null;
    pin_type: string | null;
    videos: {
      youtube_video_id: string | null;
      title: string | null;
      thumbnail_url: string | null;
      published_at: string | null;
      youtube_channels: { name: string | null } | null;
    } | null;
    places: { city_name: string | null; country_name: string | null } | null;
  } | null;
};

function rowToPin(r: FavoriteRow): SamplePin | null {
  if (!r.pins) return null;
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

function SavedScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<SamplePin | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("favorites")
      .select(
        "id, pin_id, created_at, pins(id, latitude, longitude, label, pin_type, videos(youtube_video_id, title, thumbnail_url, published_at, youtube_channels(name)), places(city_name, country_name))",
      )
      .eq("user_id", user.id)
      .eq("target_type", "pin")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setRows((data ?? []) as unknown as FavoriteRow[]);
        setLoading(false);
      });
  }, [user]);

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

      {loading ? (
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

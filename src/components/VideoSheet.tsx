import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Bookmark, MapPin, Eye, Calendar, Play } from "lucide-react";
import { useEffect, useState } from "react";
import type { SamplePin } from "@/lib/sample-data";
import { PIN_TYPE_COLORS } from "@/lib/sample-data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function VideoSheet({ pin, open, onOpenChange }: { pin: SamplePin | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [playing, setPlaying] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const pinId = pin?.id ?? null;

  // Check whether this pin is already saved when the sheet opens
  useEffect(() => {
    let cancelled = false;
    setSaved(false);
    if (!open || !pinId || !UUID_RE.test(pinId)) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("target_type", "pin")
        .eq("pin_id", pinId)
        .maybeSingle();
      if (!cancelled) setSaved(!!data);
    })();
    return () => { cancelled = true; };
  }, [open, pinId]);

  if (!pin) return null;

  async function handleSave() {
    if (!pin || saving) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sign in to save places", { action: { label: "Sign in", onClick: () => (window.location.href = "/auth") } });
      return;
    }
    // Real ingested pins have UUID ids; sample pins ("1","2"...) can't be saved.
    if (!UUID_RE.test(pin.id)) {
      toast.error("This is a sample pin and can't be saved yet.");
      return;
    }
    setSaving(true);
    if (saved) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("target_type", "pin")
        .eq("pin_id", pin.id);
      setSaving(false);
      if (error) {
        console.error(error);
        toast.error("Couldn't remove — please try again");
        return;
      }
      setSaved(false);
      toast.success("Removed from your saved places");
      return;
    }
    const { error } = await supabase
      .from("favorites")
      .insert({ user_id: user.id, target_type: "pin", pin_id: pin.id });
    setSaving(false);
    if (error && error.code !== "23505") {
      console.error(error);
      toast.error("Couldn't save — please try again");
      return;
    }
    setSaved(true);
    toast.success("Saved to your places");
  }

  return (
    <Drawer open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setPlaying(false); }}>
      <DrawerContent className="bg-card text-card-foreground border-border max-h-[92vh]">
        <div className="mx-auto w-full max-w-[520px] overflow-y-auto">
          <DrawerHeader className="px-0 pt-0">
            <div className="relative aspect-video w-full overflow-hidden rounded-t-2xl bg-black">
              {playing ? (
                <iframe
                  className="size-full"
                  src={`https://www.youtube.com/embed/${pin.youtubeId}?autoplay=1`}
                  allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <>
                  <img src={pin.thumbnail} alt={pin.title} className="size-full object-cover" />
                  <button
                    onClick={() => setPlaying(true)}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 transition hover:bg-black/40"
                    aria-label="Play video"
                  >
                    <span className="flex size-16 items-center justify-center rounded-full bg-primary shadow-2xl">
                      <Play className="size-7 fill-primary-foreground text-primary-foreground" />
                    </span>
                  </button>
                  <span
                    className="absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold text-white shadow"
                    style={{ background: PIN_TYPE_COLORS[pin.type] }}
                  >
                    {pin.type}
                  </span>
                </>
              )}
            </div>
            <div className="px-5 pt-4 text-left">
              <DrawerTitle className="font-display text-xl leading-tight">{pin.title}</DrawerTitle>
              <DrawerDescription className="sr-only">{pin.location || pin.creator}</DrawerDescription>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{pin.creator}</span>
              </div>
            </div>
          </DrawerHeader>
          <div className="grid grid-cols-3 gap-2 px-5 pb-4 text-xs text-muted-foreground">
            <Stat icon={MapPin} label={pin.location} />
            <Stat icon={Eye} label={`${pin.views} views`} />
            <Stat icon={Calendar} label={pin.uploaded} />
          </div>
          <div className="flex gap-2 px-5 pb-6 safe-bottom">
            <Button className="flex-1" size="lg" onClick={() => setPlaying(true)}>
              <Play className="size-4" /> Watch Video
            </Button>
            <Button variant="outline" size="lg" onClick={handleSave}>
              <Bookmark className="size-4" />
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Stat({ icon: Icon, label }: { icon: typeof MapPin; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl bg-surface-1 px-3 py-2">
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Bookmark, MapPin, Eye, Calendar, Play } from "lucide-react";
import { useState } from "react";
import type { SamplePin } from "@/lib/sample-data";
import { PIN_TYPE_COLORS } from "@/lib/sample-data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function VideoSheet({ pin, open, onOpenChange }: { pin: SamplePin | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [playing, setPlaying] = useState(false);

  if (!pin) return null;

  async function handleSave() {
    if (!pin) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sign in to save places", { action: { label: "Sign in", onClick: () => (window.location.href = "/auth") } });
      return;
    }
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

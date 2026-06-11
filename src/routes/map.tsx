import { createFileRoute } from "@tanstack/react-router";

import { MapView } from "@/components/MapView";
import { VideoSheet } from "@/components/VideoSheet";
import { useState } from "react";
import type { SamplePin } from "@/lib/sample-data";
import { PIN_TYPE_COLORS } from "@/lib/sample-data";
import { useFollowedChannels } from "@/lib/hooks/use-followed-channels";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Map — WanderPins" },
      { name: "description", content: "Explore the world map and tap pins to watch travel videos from real places." },
    ],
  }),
  component: MapScreen,
});

function MapScreen() {
  const [active, setActive] = useState<SamplePin | null>(null);
  const [open, setOpen] = useState(false);
  const { channelIds, pinsVersion, isAuthenticated } = useFollowedChannels();

  return (
    <div className="relative h-[calc(100dvh-5rem)]">
      <MapView
        followedChannelIds={isAuthenticated ? channelIds : undefined}
        pinsRefreshKey={pinsVersion}
        onPinClick={(p) => {
          setActive(p);
          setOpen(true);
        }}
      />
      <div className="glass safe-top absolute inset-x-3 top-3 flex items-center gap-2 rounded-2xl border border-border/60 p-2 px-3">
        <span className="font-display text-sm font-semibold">Explore</span>
        <div className="ml-auto flex items-center gap-2 text-[10px]">
          {(["trending", "new", "featured", "traveling"] as const).map((t) => (
            <span key={t} className="flex items-center gap-1 capitalize text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: PIN_TYPE_COLORS[t] }} />
              {t}
            </span>
          ))}
          <span className="flex items-center gap-1 capitalize text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: "#facc15" }} />
            saved
          </span>
        </div>
      </div>
      <VideoSheet pin={active} open={open} onOpenChange={setOpen} />
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { MapView } from "@/components/MapView";
import { VideoSheet } from "@/components/VideoSheet";
import { PIN_TYPE_COLORS } from "@/lib/sample-data";
import { useFollowedChannels } from "@/lib/hooks/use-followed-channels";
import type { SamplePin } from "@/lib/sample-data";
import { useState } from "react";
import { Compass, Plus, Maximize2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WanderPins — Discover travel through the map" },
      { name: "description", content: "Explore travel YouTube videos pinned to real places around the world." },
      { property: "og:title", content: "WanderPins" },
      { property: "og:description", content: "Google Maps meets YouTube for travel discovery." },
    ],
  }),
  component: Home,
});

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

function Home() {
  const navigate = useNavigate();
  const [activePin, setActivePin] = useState<SamplePin | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const { channels: followed, channelIds, pinsVersion, isAuthenticated, loading } = useFollowedChannels();

  // When signed in, show pins for followed channels (or just the selected one).
  const mapFilter = isAuthenticated
    ? selectedChannelId
      ? [selectedChannelId]
      : channelIds
    : undefined;
  const selectedChannel = selectedChannelId
    ? followed.find((c) => c.id === selectedChannelId) ?? null
    : null;

  return (
    <>
      <header className="safe-top flex items-center justify-between px-5 pb-2 pt-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Welcome to</p>
          <h1 className="font-display text-3xl font-bold leading-none">WanderPins</h1>
        </div>
        <Link to="/submit" className="flex size-10 items-center justify-center rounded-full bg-surface-1 active:scale-95">
          <Plus className="size-5" />
        </Link>
      </header>

      <section className="mx-5 mt-4">
        <div className="relative h-[55vh] min-h-[320px] w-full overflow-hidden rounded-3xl border border-border bg-surface-1 shadow-xl">
          <MapView
            followedChannelIds={mapFilter}
            pinsRefreshKey={pinsVersion}
            onPinClick={(p) => {
              setActivePin(p);
              setSheetOpen(true);
            }}
          />
          <div className="glass pointer-events-none absolute inset-x-3 top-3 flex items-center gap-2 rounded-2xl border border-border/60 px-3 py-2">
            <Compass className="size-4 text-primary" />
            <span className="font-display text-sm font-semibold">
              {selectedChannel ? selectedChannel.name : isAuthenticated ? "Channels you follow" : "Explore the world"}
            </span>
            <div className="ml-auto flex items-center gap-2 text-[10px]">
              {(["trending", "new", "featured", "traveling"] as const).map((t) => (
                <span key={t} className="flex items-center gap-1 capitalize text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: PIN_TYPE_COLORS[t] }} />
                  {t}
                </span>
              ))}
            </div>
          </div>
          {selectedChannel && (
            <div className="glass absolute inset-x-3 bottom-14 flex items-center gap-3 rounded-2xl border border-border/60 p-2.5">
              {selectedChannel.thumbnail_url ? (
                <img src={selectedChannel.thumbnail_url} alt={selectedChannel.name} className="size-10 rounded-full object-cover" />
              ) : (
                <div className="size-10 rounded-full bg-surface-2" />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 font-display text-sm font-bold">{selectedChannel.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {selectedChannel.subscriber_count ? `${formatNum(Number(selectedChannel.subscriber_count))} subs` : ""}
                  {selectedChannel.current_location ? ` · ${selectedChannel.current_location}` : ""}
                </p>
              </div>
              <Link
                to="/channel/$handle"
                params={{ handle: selectedChannel.youtube_channel_id }}
                className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground active:scale-95"
              >
                View
              </Link>
              <button
                onClick={() => setSelectedChannelId(null)}
                className="rounded-full bg-surface-2 px-2.5 py-1.5 text-[11px] font-semibold active:scale-95"
                aria-label="Clear selection"
              >
                ✕
              </button>
            </div>
          )}
          {isAuthenticated && !loading && followed.length === 0 && (
            <div className="glass absolute inset-x-6 bottom-14 rounded-2xl border border-border/60 p-4 text-center text-xs">
              You aren't following any channels yet. Search and follow creators to populate your map.
            </div>
          )}
          <button
            onClick={() => navigate({ to: "/map" })}
            className="glass absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-2 text-xs font-semibold active:scale-95"
          >
            <Maximize2 className="size-3.5" /> Full map
          </button>
        </div>
        <VideoSheet pin={activePin} open={sheetOpen} onOpenChange={setSheetOpen} />
      </section>
    </>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { MapView } from "@/components/MapView";
import { VideoSheet } from "@/components/VideoSheet";
import { useFollowedChannels } from "@/lib/hooks/use-followed-channels";
import type { SamplePin } from "@/lib/sample-data";
import { useState } from "react";
import { Sparkles, Plus, Maximize2, Users } from "lucide-react";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MyWayPins — Discover travel through the map" },
      { name: "description", content: "Explore travel YouTube videos pinned to real places around the world." },
      { property: "og:title", content: "MyWayPins" },
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
          <h1 className="font-display text-2xl font-bold leading-none">MyWayPins</h1>
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

      {isAuthenticated && (
        <Section title="Channels you follow" icon={Users}>
          {followed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You aren't following anyone yet.{" "}
              <Link to="/search" className="text-primary underline">Find creators</Link>.
            </p>
          ) : (
            <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-4">
              <button
                onClick={() => setSelectedChannelId(null)}
                className={`flex w-20 shrink-0 cursor-pointer flex-col items-center text-center active:scale-95 ${selectedChannelId === null ? "" : "opacity-60"}`}
              >
                <div className={`flex size-16 items-center justify-center rounded-xl bg-surface-2 ring-2 ${selectedChannelId === null ? "ring-primary" : "ring-border"}`}>
                  <Users className="size-6 text-primary" />
                </div>
                <p className="mt-1.5 line-clamp-1 text-xs font-medium">All</p>
                <p className="text-[10px] text-muted-foreground">{followed.length} channels</p>
              </button>
              {followed.map((c) => {
                const isSelected = selectedChannelId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedChannelId(isSelected ? null : c.id)}
                    className={`flex w-20 shrink-0 cursor-pointer flex-col items-center text-center active:scale-95 ${isSelected || selectedChannelId === null ? "" : "opacity-60"}`}
                  >
                    {c.thumbnail_url ? (
                      <img
                        src={c.thumbnail_url}
                        alt={c.name}
                        className={`size-16 rounded-xl object-cover ring-2 ${isSelected ? "ring-primary" : "ring-border"}`}
                      />
                    ) : (
                      <div className={`size-16 rounded-xl bg-surface-2 ring-2 ${isSelected ? "ring-primary" : "ring-border"}`} />
                    )}

                    <p className="mt-1.5 line-clamp-1 text-xs font-medium">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.subscriber_count ? `${formatNum(Number(c.subscriber_count))} subs` : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </Section>
      )}

    </>
  );
}


function Section({ title, icon: Icon, children }: { title: string; icon?: typeof Sparkles; children: React.ReactNode }) {
  return (
    <section className="mt-6 px-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
        {Icon && <Icon className="size-4 text-primary" />} {title}
      </h2>
      {children}
    </section>
  );
}

import { createFileRoute } from "@tanstack/react-router";

import { MapView } from "@/components/MapView";
import { VideoSheet } from "@/components/VideoSheet";
import { useState } from "react";
import { Youtube, MapPin, FolderHeart } from "lucide-react";
import type { SamplePin } from "@/lib/sample-data";
import { useFollowedChannels } from "@/lib/hooks/use-followed-channels";
import { useChannelMarkers } from "@/lib/hooks/use-channel-marker-data";
import { useMyCollections } from "@/lib/hooks/use-my-collections";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Map — WanderPins" },
      { name: "description", content: "Explore the world map and tap pins to watch travel videos from real places." },
    ],
  }),
  component: MapScreen,
});

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

function MapScreen() {
  const [active, setActive] = useState<SamplePin | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const { channels, channelIds, pinsVersion, isAuthenticated } = useFollowedChannels();
  const { data: channelMarkers } = useChannelMarkers(channels);
  const { collections } = useMyCollections();

  const selectedCollection = collections.find((c) => c.id === selectedCollectionId) ?? null;
  const mapChannelFilter = isAuthenticated && !selectedCollection
    ? selectedChannelId ? [selectedChannelId] : channelIds
    : undefined;
  const mapVideoFilter = selectedCollection ? selectedCollection.video_ids : undefined;
  const savedVideoIds = Array.from(new Set(collections.flatMap((c) => c.video_ids)));

  const allMarkers = channelMarkers ?? [];
  let visibleMarkers = allMarkers;
  if (selectedCollection && selectedCollection.video_ids.length > 0) {
    const ids = selectedCollection.video_ids;
    visibleMarkers = allMarkers.filter((m) => m.videoId && ids.includes(m.videoId));
  } else if (selectedChannelId) {
    visibleMarkers = allMarkers.filter((m) => m.channelId === selectedChannelId);
  }

  function pickChannel(id: string) {
    setSelectedCollectionId(null);
    setSelectedChannelId((cur) => (cur === id ? null : id));
  }
  function pickCollection(id: string) {
    setSelectedChannelId(null);
    setSelectedCollectionId((cur) => (cur === id ? null : id));
  }

  return (
    <div className="relative h-[calc(100dvh-5rem)]">
      <MapView
        followedChannelIds={mapChannelFilter}
        videoIdsFilter={mapVideoFilter}
        savedVideoIds={savedVideoIds}
        pinsRefreshKey={pinsVersion}
        channelMarkers={visibleMarkers}
        onChannelMarkerClick={(id) => pickChannel(id)}
        onPinClick={(p) => {
          setActive(p);
          setOpen(true);
        }}
      />

      {isAuthenticated && (
        <div className="absolute inset-x-0 bottom-3 z-10">
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3">
            {/* Channels */}
            {channels.slice(0, 24).map((c) => {
              const isSelected = selectedChannelId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickChannel(c.id)}
                  aria-pressed={isSelected}
                  className={`group relative flex w-[35px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-md bg-surface-1/90 text-left ring-1 backdrop-blur active:scale-95 ${
                    isSelected ? "ring-2 ring-primary" : "ring-border"
                  }`}
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-surface-2">
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt={c.name} className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <Youtube className="size-3" />
                      </div>
                    )}
                  </div>
                  <div className="px-0.5 py-0.5">
                    <p className="line-clamp-1 text-[6px] font-semibold leading-tight">{c.name}</p>
                    {c.current_location && (
                      <p className="flex items-center gap-0.5 text-[5px] leading-tight text-muted-foreground">
                        <MapPin className="size-[5px]" />
                        <span className="line-clamp-1">{c.current_location}</span>
                      </p>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Collections */}
            {collections.map((col) => {
              const isSelected = selectedCollectionId === col.id;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => pickCollection(col.id)}
                  aria-pressed={isSelected}
                  className={`group relative flex w-[35px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-md bg-surface-1/90 text-left ring-1 backdrop-blur active:scale-95 ${
                    isSelected ? "ring-2 ring-primary" : "ring-border"
                  }`}
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-surface-2">
                    {col.cover_image_url ? (
                      <img src={col.cover_image_url} alt={col.name} className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-primary">
                        <FolderHeart className="size-3" />
                      </div>
                    )}
                  </div>
                  <div className="px-0.5 py-0.5">
                    <p className="line-clamp-1 text-[6px] font-semibold leading-tight">{col.name}</p>
                    <p className="line-clamp-1 text-[5px] leading-tight text-muted-foreground">
                      {col.item_count} {col.item_count === 1 ? "v" : "v"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <VideoSheet pin={active} open={open} onOpenChange={setOpen} />
    </div>
  );
}

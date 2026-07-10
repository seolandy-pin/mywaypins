import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { MapView } from "@/components/MapView";
import { VideoSheet } from "@/components/VideoSheet";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { useFollowedChannels } from "@/lib/hooks/use-followed-channels";
import { useChannelMarkers } from "@/lib/hooks/use-channel-marker-data";
import { useNewVideoNotifications } from "@/lib/hooks/use-new-video-notifications";
import { useMyCollections } from "@/lib/hooks/use-my-collections";
import { useRefreshFollowedOnLoad } from "@/lib/hooks/use-refresh-followed-on-load";
import { useRefreshHome } from "@/lib/hooks/use-refresh-home";
import { useAutoRefreshOnFocus } from "@/lib/hooks/use-auto-refresh-on-focus";
import { useFcmRegister } from "@/lib/hooks/use-fcm-register";
import { PullToRefresh } from "@/components/PullToRefresh";
import type { SamplePin } from "@/lib/sample-data";
import { useRef, useState } from "react";
import { useDragScroll } from "@/lib/hooks/use-drag-scroll";
import { Plus, Maximize2, Bell, MapPin, Plane, Youtube, FolderHeart, Bookmark } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MyWayPins — Your Travel YouTube Collection" },
      { name: "description", content: "Follow travel YouTubers and watch their videos pinned to real places around the world." },
      { property: "og:title", content: "MyWayPins" },
      { property: "og:description", content: "Your Travel YouTube Collection." },
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
  const channelsScrollRef = useDragScroll<HTMLDivElement>();
  const collectionsScrollRef = useDragScroll<HTMLDivElement>();
  const contentRef = useRef<HTMLDivElement>(null);
  const [activePin, setActivePin] = useState<SamplePin | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [onlySaved, setOnlySaved] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const { channels: followed, channelIds, pinsVersion, isAuthenticated } = useFollowedChannels();
  const { collections } = useMyCollections();

  const selectedCollection = collections.find((c) => c.id === selectedCollectionId) ?? null;
  const mapChannelFilter = !isAuthenticated
    ? []
    : selectedCollection
      ? undefined
      : selectedChannelId ? [selectedChannelId] : channelIds;
  const mapVideoFilter = selectedCollection ? selectedCollection.video_ids : undefined;

  const markersQuery = useChannelMarkers(followed);
  const allMarkers = markersQuery.data ?? [];
  const visibleMarkers = selectedChannelId
    ? allMarkers.filter((m) => m.channelId === selectedChannelId)
    : allMarkers;

  const { items: notifications, unreadCount, dismissOne, dismissAll } =
    useNewVideoNotifications(channelIds);
  useRefreshFollowedOnLoad();
  useFcmRegister();
  const refreshHome = useRefreshHome();
  useAutoRefreshOnFocus(refreshHome);

  function pickChannel(id: string) {
    setSelectedCollectionId(null);
    setSelectedChannelId((cur) => (cur === id ? null : id));
  }
  function pickCollection(id: string) {
    setSelectedChannelId(null);
    setSelectedCollectionId((cur) => (cur === id ? null : id));
  }

  return (
    <div className="flex h-[calc(100dvh-6rem)] flex-col overflow-hidden">
      <div className="shrink-0">
        <header className="safe-top px-4 pb-3 pt-3">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold leading-none">
                <span className="text-foreground">MyWay</span>
                <span className="text-primary">Pins</span>
                <span className="relative ml-0.5 inline-block size-5 -translate-y-1 align-baseline">
                  <MapPin className="size-5 fill-primary text-primary" strokeWidth={0} />
                  <svg
                    viewBox="0 0 24 24"
                    className="absolute left-1/2 top-[38%] size-2.5 -translate-x-1/2 -translate-y-1/2 fill-background"
                    aria-hidden="true"
                  >
                    <polygon points="8,5 8,19 19,12" />
                  </svg>
                </span>
              </h1>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                Your Travel YouTube Collection
                <Plane className="size-3" />
              </p>
            </div>
            {isAuthenticated && (
              <div className="flex items-center gap-2">
                <NotificationsPanel
                  open={notifOpen}
                  onOpenChange={setNotifOpen}
                  items={notifications}
                  unreadCount={unreadCount}
                  onClearAll={dismissAll}
                  onDismissItem={(it) => dismissOne(it.youtubeId)}
                  onItemClick={(it) => {
                    dismissOne(it.youtubeId);
                    setNotifOpen(false);
                    setActivePin({
                      id: it.videoDbId,
                      lat: 0,
                      lng: 0,
                      type: "new",
                      title: it.title,
                      creator: it.channelName,
                      thumbnail: it.thumbnailUrl ?? "",
                      location: "",
                      views: "",
                      uploaded: new Date(it.publishedAt).toLocaleDateString(),
                      youtubeId: it.youtubeId,
                      videoDbId: it.videoDbId,
                      noPin: true,
                    });
                    setSheetOpen(true);
                  }}
                  trigger={
                    <button
                      type="button"
                      aria-label="Notifications"
                      className="relative flex size-9 cursor-pointer items-center justify-center rounded-full text-foreground hover:bg-surface-1 active:scale-95"
                    >
                      <Bell className="size-[18px]" />
                      {unreadCount > 0 && (
                        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground ring-2 ring-background">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>
                  }
                />
                <Link
                  to="/submit"
                  aria-label="Submit a channel"
                  className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95"
                >
                  <Plus className="size-[18px]" />
                </Link>
              </div>
            )}
          </div>
        </header>

        <section className="mx-4">
          <div className="relative h-[58vh] min-h-[340px] w-full overflow-hidden rounded-3xl border border-border bg-surface-1 shadow-xl">
            <MapView
              followedChannelIds={mapChannelFilter}
              videoIdsFilter={mapVideoFilter}
              pinsRefreshKey={pinsVersion}
              channelMarkers={visibleMarkers}
              onChannelMarkerClick={(id) => pickChannel(id)}
              onlySaved={onlySaved}
              onPinClick={(p) => {
                setActivePin(p);
                setSheetOpen(true);
              }}
            />

            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setOnlySaved((v) => !v)}
                aria-pressed={onlySaved}
                title={onlySaved ? "Showing saved pins only" : "Show saved pins only"}
                className={`absolute right-2.5 top-[88px] z-10 flex size-[29px] items-center justify-center rounded-[4px] shadow-[0_0_0_2px_rgba(0,0,0,0.1)] transition active:scale-95 ${
                  onlySaved ? "bg-primary text-white" : "bg-white text-gray-800 hover:bg-gray-50"
                }`}
              >
                <Bookmark className={`size-4 ${onlySaved ? "fill-white" : ""}`} />
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate({ to: "/map" })}
              className="glass absolute bottom-3 left-3 flex cursor-pointer items-center gap-1.5 rounded-full border border-border/60 px-3 py-2 text-xs font-semibold active:scale-95"
            >
              <Maximize2 className="size-3.5" /> Explore Full Map
            </button>

          </div>
          <VideoSheet pin={activePin} open={sheetOpen} onOpenChange={setSheetOpen} />
        </section>
      </div>

      <PullToRefresh
        onRefresh={refreshHome}
        scrollContainerRef={contentRef}
        className="flex-1 min-h-0"
      >
        <div ref={contentRef} className="h-full overflow-y-auto">
          <section className="mt-5 px-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-base font-bold">
                <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Youtube className="size-4" />
                </span>
                Favorite Creators
              </h2>
              <Link to="/following" className="flex cursor-pointer items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                View All ›
              </Link>
            </div>

            {!isAuthenticated ? (
              <p className="text-sm text-muted-foreground">
                <Link to="/auth" className="text-primary underline">Sign in</Link> to follow your favorite travel channels.
              </p>
            ) : followed.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No channels yet. <Link to="/search" className="text-primary underline">Find creators</Link>.
              </p>
            ) : (
              <div ref={channelsScrollRef} className="no-scrollbar -mx-4 flex cursor-grab gap-2 overflow-x-auto px-4 pb-4 select-none">

                {followed.slice(0, 24).map((c) => {
                  const isSelected = selectedChannelId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pickChannel(c.id)}
                      aria-pressed={isSelected}
                      className={`group relative flex w-[70px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-lg bg-surface-1 text-left ring-1 active:scale-95 ${
                        isSelected ? "ring-2 ring-primary" : "ring-border"
                      }`}
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-surface-2">
                        {c.thumbnail_url ? (
                          <img src={c.thumbnail_url} alt={c.name} className="size-full object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-muted-foreground">
                            <Youtube className="size-4" />
                          </div>
                        )}
                      </div>
                      <div className="p-1">
                        <p className="line-clamp-1 text-[9px] font-semibold leading-tight">{c.name}</p>
                        <p className="line-clamp-1 text-[8px] leading-tight text-muted-foreground">
                          {c.subscriber_count ? `${formatNum(Number(c.subscriber_count))} subs` : "—"}
                        </p>
                        {c.current_location && (
                          <p className="mt-0.5 flex items-center gap-0.5 text-[8px] leading-tight text-muted-foreground">
                            <MapPin className="size-2" />
                            <span className="line-clamp-1">{c.current_location}</span>
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

            )}
          </section>

          {isAuthenticated && (
          <section className="mt-2 px-4">
            <div className="mb-3 flex items-center justify-between">
              <Link
                to="/profile/collections"
                className="flex items-center gap-2 font-display text-base font-bold"
              >
                <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <FolderHeart className="size-4" />
                </span>
                Travel Logs
              </Link>
                <Link to="/profile/collections" className="flex cursor-pointer items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                  View All ›
                </Link>
              </div>

              {collections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Create folders to save individual videos.{" "}
                  <Link to="/submit" search={{ tab: "video" } as never} className="text-primary underline">Save a video</Link>.
                </p>
              ) : (
                <div ref={collectionsScrollRef} className="no-scrollbar -mx-4 flex cursor-grab gap-2 overflow-x-auto px-4 pb-4 select-none">
                  {collections.map((c) => {
                    const isSelected = selectedCollectionId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => pickCollection(c.id)}
                        aria-pressed={isSelected}
                        className={`group relative flex w-[70px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-lg bg-surface-1 text-left ring-1 active:scale-95 ${
                          isSelected ? "ring-2 ring-primary" : "ring-border"
                        }`}
                      >
                        <div className="relative aspect-square w-full overflow-hidden bg-surface-2">
                          {c.cover_image_url ? (
                            <img src={c.cover_image_url} alt={c.name} className="size-full object-cover" />
                          ) : (
                            <div className="flex size-full items-center justify-center text-primary">
                              <FolderHeart className="size-5" />
                            </div>
                          )}
                        </div>
                        <div className="p-1">
                          <p className="line-clamp-1 text-[9px] font-semibold leading-tight">{c.name}</p>
                          <p className="line-clamp-1 text-[8px] leading-tight text-muted-foreground">
                            {c.item_count} {c.item_count === 1 ? "video" : "videos"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      </PullToRefresh>
    </div>
  );
}

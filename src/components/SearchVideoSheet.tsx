import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ExternalLink, UserPlus, UserCheck, Eye, Play, Bookmark } from "lucide-react";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { YTVideoResult } from "@/lib/youtube.functions";
import { followChannel, unfollowChannel, getFollowStatus } from "@/lib/follows.functions";
import {
  saveSearchVideo,
  unsaveSearchVideo,
  getSearchVideoSavedStatus,
} from "@/lib/search-favorites.functions";
import { useAuth } from "@/lib/auth/use-auth";

function formatNum(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

export function SearchVideoSheet({
  video,
  open,
  onOpenChange,
}: {
  video: YTVideoResult | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const statusFn = useServerFn(getFollowStatus);
  const followFn = useServerFn(followChannel);
  const unfollowFn = useServerFn(unfollowChannel);
  const savedStatusFn = useServerFn(getSearchVideoSavedStatus);
  const saveFn = useServerFn(saveSearchVideo);
  const unsaveFn = useServerFn(unsaveSearchVideo);

  const channelId = video?.channelId;
  const videoId = video?.id;

  const followStatus = useQuery({
    queryKey: ["follow-status", channelId],
    enabled: Boolean(channelId) && isAuthenticated && open,
    queryFn: () => statusFn({ data: { youtubeChannelId: channelId! } }),
  });

  const following = followStatus.data?.following ?? false;

  const toggle = useMutation({
    mutationFn: async () => {
      if (!video) throw new Error("no video");
      if (following) {
        return unfollowFn({ data: { youtubeChannelId: video.channelId } });
      }
      return followFn({
        data: {
          youtubeChannelId: video.channelId,
          name: video.channelTitle,
          thumbnailUrl: video.channelThumbnail ?? null,
          channelUrl: video.channelHandle
            ? `https://www.youtube.com/@${video.channelHandle}`
            : `https://www.youtube.com/channel/${video.channelId}`,
        },
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["follow-status", channelId] });
      queryClient.invalidateQueries({ queryKey: ["my-followed-channels"] });
      if (result && "ingestionStarted" in result && result.ingestionStarted) {
        toast.success("Following — adding their travel locations to the map…", {
          description: "Pins will appear shortly (usually under a minute).",
        });
      } else if (result && "following" in result && result.following) {
        toast.success("Following");
      } else {
        toast.success("Unfollowed");
      }
    },
    onError: (e) => {
      console.error(e);
      toast.error("Couldn't update follow — please try again");
    },
  });

  const savedStatus = useQuery({
    queryKey: ["search-video-saved", videoId],
    enabled: Boolean(videoId) && isAuthenticated && open,
    queryFn: () => savedStatusFn({ data: { youtubeVideoId: videoId! } }),
  });
  const saved = savedStatus.data?.saved ?? false;

  const saveToggle = useMutation({
    mutationFn: async () => {
      if (!video) throw new Error("no video");
      if (saved) {
        return unsaveFn({ data: { youtubeVideoId: video.id } });
      }
      return saveFn({
        data: {
          youtubeVideoId: video.id,
          title: video.title,
          thumbnailUrl: video.thumbnail ?? null,
          publishedAt: video.publishedAt ?? null,
          viewCount: video.viewCount ?? null,
          youtubeChannelId: video.channelId,
          channelName: video.channelTitle,
          channelThumbnailUrl: video.channelThumbnail ?? null,
          channelUrl: video.channelHandle
            ? `https://www.youtube.com/@${video.channelHandle}`
            : `https://www.youtube.com/channel/${video.channelId}`,
        },
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["search-video-saved", videoId] });
      window.dispatchEvent(new Event("wanderpins:favorites-changed"));
      if (result && "saved" in result && result.saved) {
        toast.success("Saved to your places");
      } else {
        toast.success("Removed from your saved places");
      }
    },
    onError: (e) => {
      console.error(e);
      toast.error("Couldn't save — please try again");
    },
  });

  useEffect(() => {
    if (!open) {
      toggle.reset();
      saveToggle.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!video) return null;

  const handleFollowClick = () => {
    if (!isAuthenticated) {
      toast.error("Sign in to follow creators", {
        action: { label: "Sign in", onClick: () => (window.location.href = "/auth") },
      });
      return;
    }
    toggle.mutate();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card text-card-foreground border-border max-h-[92vh]">
        <div className="mx-auto w-full max-w-[520px] overflow-y-auto">
          <DrawerHeader className="px-0 pt-0">
            <div className="relative aspect-video w-full overflow-hidden rounded-t-2xl bg-black">
              <iframe
                className="size-full"
                src={`https://www.youtube.com/embed/${video.id}?autoplay=1&playsinline=1&rel=0`}
                title={video.title}
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="px-5 pt-4 text-left">
              <DrawerTitle className="font-display text-lg leading-tight">{video.title}</DrawerTitle>
              <DrawerDescription className="sr-only">{video.channelTitle}</DrawerDescription>
              <div className="mt-3 flex items-center gap-3">
                {video.channelThumbnail ? (
                  <img src={video.channelThumbnail} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="size-10 shrink-0 rounded-full bg-surface-1" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold">{video.channelTitle}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    <Eye className="mr-1 inline size-3" />
                    {formatNum(video.viewCount)} views
                  </p>
                </div>
              </div>
            </div>
          </DrawerHeader>
          <div className="flex gap-2 px-5 pb-6 pt-4 safe-bottom">
            <Button
              className="flex-1"
              size="lg"
              variant={following ? "outline" : "default"}
              onClick={handleFollowClick}
              disabled={toggle.isPending || followStatus.isLoading}
            >
              {following ? (
                <>
                  <UserCheck className="size-4" /> Following
                </>
              ) : (
                <>
                  <UserPlus className="size-4" /> Follow & pin to map
                </>
              )}
            </Button>
            <Button variant="outline" size="lg" asChild aria-label="Open on YouTube">
              <a
                href={`https://www.youtube.com/watch?v=${video.id}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                <ExternalLink className="size-4" />
              </a>
            </Button>
            <Button
              variant={saved ? "default" : "outline"}
              size="lg"
              onClick={() => {
                if (!isAuthenticated) {
                  toast.error("Sign in to save places", {
                    action: { label: "Sign in", onClick: () => (window.location.href = "/auth") },
                  });
                  return;
                }
                saveToggle.mutate();
              }}
              disabled={saveToggle.isPending || savedStatus.isLoading}
              aria-label={saved ? "Remove from saved" : "Save video"}
            >
              <Bookmark className={saved ? "size-4 fill-current" : "size-4"} />
            </Button>
          </div>
          {!following && (
            <p className="px-5 pb-6 text-center text-[11px] text-muted-foreground">
              <Play className="mr-1 inline size-3" />
              Following adds this creator's travel locations to your map automatically.
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

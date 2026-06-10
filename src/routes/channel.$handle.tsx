import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BadgeCheck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/use-auth";
import { followChannel, unfollowChannel, getFollowStatus } from "@/lib/follows.functions";
import { getYouTubeChannelByHandleFn } from "@/lib/youtube.functions";

export const Route = createFileRoute("/channel/$handle")({
  head: ({ params }) => ({
    meta: [{ title: `@${params.handle} — WanderPins` }],
  }),
  component: ChannelPage,
});

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

function ChannelPage() {
  const { handle } = Route.useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const fetchChannelFn = useServerFn(getYouTubeChannelByHandleFn);

  const channelQuery = useQuery({
    queryKey: ["yt-channel", handle],
    staleTime: 1000 * 60 * 60,
    queryFn: () => fetchChannelFn({ data: { handle } }),
  });


  const ytId = channelQuery.data?.id;

  const statusFn = useServerFn(getFollowStatus);
  const followFn = useServerFn(followChannel);
  const unfollowFn = useServerFn(unfollowChannel);

  const followStatus = useQuery({
    queryKey: ["follow-status", ytId],
    enabled: Boolean(ytId) && isAuthenticated,
    queryFn: () => statusFn({ data: { youtubeChannelId: ytId! } }),
  });

  const following = followStatus.data?.following ?? false;

  const toggle = useMutation({
    mutationFn: async () => {
      const ch = channelQuery.data!;
      if (following) {
        return unfollowFn({ data: { youtubeChannelId: ch.id } });
      }
      return followFn({
        data: {
          youtubeChannelId: ch.id,
          name: ch.snippet.title,
          thumbnailUrl: ch.snippet.thumbnails.high?.url ?? ch.snippet.thumbnails.medium?.url ?? ch.snippet.thumbnails.default?.url ?? null,
          channelUrl: ch.snippet.customUrl ? `https://www.youtube.com/${ch.snippet.customUrl}` : `https://www.youtube.com/channel/${ch.id}`,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-status", ytId] });
      queryClient.invalidateQueries({ queryKey: ["my-followed-channels"] });
    },
  });

  if (!apiKey) {
    return <div className="safe-top p-6 text-sm text-muted-foreground">YouTube API key not configured.</div>;
  }

  if (channelQuery.isLoading) {
    return <div className="safe-top p-6 text-sm text-muted-foreground">Loading channel…</div>;
  }

  if (channelQuery.error || !channelQuery.data) {
    return (
      <div className="safe-top p-6">
        <button onClick={() => router.history.back()} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> Back
        </button>
        <p className="text-sm">Couldn’t find channel @{handle}.</p>
      </div>
    );
  }

  const ch = channelQuery.data;
  const avatar = ch.snippet.thumbnails.high?.url ?? ch.snippet.thumbnails.medium?.url ?? ch.snippet.thumbnails.default?.url;
  const subs = ch.statistics.hiddenSubscriberCount ? null : Number(ch.statistics.subscriberCount ?? 0);

  return (
    <div className="safe-top pb-10">
      <header className="flex items-center gap-3 px-5 pt-3">
        <button onClick={() => router.history.back()} className="flex size-9 items-center justify-center rounded-full bg-surface-1 active:scale-95">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-display text-lg font-semibold">Channel</h1>
      </header>

      <section className="flex flex-col items-center px-5 pt-6 text-center">
        {avatar && <img src={avatar} alt={ch.snippet.title} className="size-24 rounded-full object-cover ring-2 ring-border" />}
        <h2 className="mt-3 flex items-center gap-1 font-display text-2xl font-bold">
          {ch.snippet.title}
          <BadgeCheck className="size-5 text-primary" />
        </h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-3.5" />
          {subs === null ? "Subscribers hidden" : `${formatNum(subs)} subscribers`}
        </p>

        <div className="mt-5 flex gap-2">
          {isAuthenticated ? (
            <Button
              size="lg"
              variant={following ? "secondary" : "default"}
              disabled={toggle.isPending || followStatus.isLoading}
              onClick={() => toggle.mutate()}
            >
              {toggle.isPending ? "…" : following ? "Following" : "Follow"}
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link to="/auth">Sign in to follow</Link>
            </Button>
          )}
          <Button asChild size="lg" variant="outline">
            <a href={`https://www.youtube.com/channel/${ch.id}`} target="_blank" rel="noreferrer">
              Open on YouTube
            </a>
          </Button>
        </div>
      </section>

      {ch.snippet.description && (
        <section className="mt-8 px-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">About</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{ch.snippet.description}</p>
        </section>
      )}
    </div>
  );
}

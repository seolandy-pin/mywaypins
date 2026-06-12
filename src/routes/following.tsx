import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Users } from "lucide-react";

import { useAuth } from "@/lib/auth/use-auth";
import { Button } from "@/components/ui/button";
import { listMyFollowedChannels } from "@/lib/follows.functions";
import { useNewVideosByChannel, markChannelSeen } from "@/lib/hooks/use-new-videos-by-channel";

export const Route = createFileRoute("/following")({
  head: () => ({ meta: [{ title: "Following — WanderPins" }] }),
  component: FollowingScreen,
});

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

function FollowingScreen() {
  const { isAuthenticated, loading } = useAuth();
  const listFn = useServerFn(listMyFollowedChannels);
  const followed = useQuery({
    queryKey: ["my-followed-channels"],
    enabled: isAuthenticated,
    queryFn: () => listFn(),
  });

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  if (!isAuthenticated) {
    return (
      <div className="safe-top flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Bell className="size-10 text-primary" />
        <h2 className="font-display text-2xl font-bold">Follow your favorite creators</h2>
        <p className="text-sm text-muted-foreground text-balance">
          Sign in to follow travel creators and get notified about new uploads from places you love.
        </p>
        <Button asChild size="lg" className="mt-2"><Link to="/auth">Sign in</Link></Button>
      </div>
    );
  }

  const rows = (followed.data ?? []) as Array<{
    created_at: string;
    youtube_channels: {
      id: string;
      youtube_channel_id: string;
      name: string;
      thumbnail_url: string | null;
      subscriber_count: number | null;
      current_location: string | null;
      is_currently_traveling: boolean | null;
    } | null;
  }>;

  const channelIds = rows.map((r) => r.youtube_channels?.id).filter((v): v is string => Boolean(v));
  const { newChannelIds } = useNewVideosByChannel(channelIds);

  return (
    <>
      <header className="safe-top px-5 pt-4">
        <h1 className="font-display text-2xl font-bold">Following</h1>
        <p className="text-sm text-muted-foreground">Creators you follow.</p>
      </header>

      <section className="px-5 pt-5">
        {followed.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-card p-6 text-center">
            <Users className="mx-auto size-8 text-primary" />
            <p className="mt-3 text-sm font-semibold">You aren’t following anyone yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Tap a creator on the home page to follow them.</p>
            <Button asChild size="sm" className="mt-4"><Link to="/">Browse creators</Link></Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => {
              const c = r.youtube_channels;
              if (!c) return null;
              const hasNew = newChannelIds.has(c.id);
              return (
                <li key={c.id}>
                  <Link
                    to="/channel/$handle"
                    params={{ handle: c.youtube_channel_id }}
                    onClick={() => markChannelSeen(c.id)}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl bg-card p-3 transition-colors hover:bg-accent"
                  >
                    {c.thumbnail_url && (
                      <div className="relative shrink-0">
                        <img src={c.thumbnail_url} alt={c.name} className="size-14 rounded-full object-cover" />
                        {hasNew && (
                          <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-red-500 ring-2 ring-card" />
                        )}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-semibold">
                        {c.name}
                        {hasNew && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-500">
                            NEW
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.subscriber_count ? `${formatNum(Number(c.subscriber_count))} subs` : "Subscribers hidden"}
                        {c.is_currently_traveling && c.current_location ? ` · In ${c.current_location}` : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Users, Plus } from "lucide-react";

import { useAuth } from "@/lib/auth/use-auth";
import { Button } from "@/components/ui/button";
import { listMyFollowedChannels } from "@/lib/follows.functions";
import { useNewVideoFlags } from "@/lib/hooks/use-new-video-flags";

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

  const channelIdList = rows.map((r) => r.youtube_channels?.id).filter((x): x is string => Boolean(x));
  const { counts, markChannelSeen } = useNewVideoFlags(channelIdList);

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
              const newCount = counts[c.id] ?? 0;
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
                        {newCount > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-card">
                            {newCount > 9 ? "9+" : newCount}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-semibold">
                        {c.name}
                        {newCount > 0 && (
                          <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 align-middle text-[10px] font-semibold text-primary">
                            New
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

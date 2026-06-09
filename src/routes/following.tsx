import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/layout/MobileShell";
import { useAuth } from "@/lib/auth/use-auth";
import { popularCreators, samplePins } from "@/lib/sample-data";
import { Button } from "@/components/ui/button";
import { Bell, MapPin } from "lucide-react";

export const Route = createFileRoute("/following")({
  head: () => ({ meta: [{ title: "Following — WanderPins" }] }),
  component: FollowingScreen,
});

function FollowingScreen() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <MobileShell><div className="p-6 text-sm text-muted-foreground">Loading…</div></MobileShell>;

  if (!isAuthenticated) {
    return (
      <MobileShell>
        <div className="safe-top flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
          <Bell className="size-10 text-primary" />
          <h2 className="font-display text-2xl font-bold">Follow your favorite creators</h2>
          <p className="text-sm text-muted-foreground text-balance">
            Sign in to follow travel creators and get notified about new uploads from places you love.
          </p>
          <Button asChild size="lg" className="mt-2"><Link to="/auth">Sign in</Link></Button>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <header className="safe-top px-5 pt-4">
        <h1 className="font-display text-2xl font-bold">Following</h1>
        <p className="text-sm text-muted-foreground">Creators you follow and where they are right now.</p>
      </header>

      <section className="px-5 pt-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Now traveling</h2>
        <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5">
          {popularCreators.filter(c => c.traveling).map((c) => (
            <div key={c.name} className="w-32 shrink-0 rounded-2xl bg-card p-3 text-center">
              <img src={c.avatar} className="mx-auto size-14 rounded-full object-cover" alt="" />
              <p className="mt-2 text-sm font-semibold">{c.name}</p>
              <p className="flex items-center justify-center gap-1 text-xs text-pin-traveling">
                <span className="size-1.5 animate-pulse rounded-full bg-pin-traveling" /> {c.traveling}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent uploads</h2>
        <ul className="space-y-3">
          {samplePins.slice(0, 4).map((p) => (
            <li key={p.id} className="flex gap-3 rounded-2xl bg-card p-3">
              <img src={p.thumbnail} alt={p.title} className="size-20 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold">{p.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{p.creator}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" /> {p.location} · {p.uploaded}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </MobileShell>
  );
}

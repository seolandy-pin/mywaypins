import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MobileShell } from "@/components/layout/MobileShell";
import { useAuth } from "@/lib/auth/use-auth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Bookmark, FolderHeart, Users, LogOut, Settings, Plus, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — WanderPins" }] }),
  component: ProfileScreen,
});

function ProfileScreen() {
  const { user, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name?: string; avatar_url?: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [user]);

  if (loading) return <MobileShell><div className="p-6 text-sm text-muted-foreground">Loading…</div></MobileShell>;

  if (!isAuthenticated) {
    return (
      <MobileShell>
        <div className="safe-top flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="rounded-full bg-surface-2 p-4"><UserIcon className="size-8 text-primary" /></div>
          <h2 className="font-display text-2xl font-bold">Your travel passport</h2>
          <p className="text-sm text-muted-foreground text-balance">
            Sign in to save places, build travel collections, and follow creators.
          </p>
          <Button asChild size="lg" className="mt-2"><Link to="/auth">Sign in or create account</Link></Button>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <header className="safe-top flex items-center gap-4 px-5 pt-6">
        <div className="size-16 overflow-hidden rounded-full bg-surface-2 ring-2 ring-border">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center"><UserIcon className="size-6 text-muted-foreground" /></div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold">{profile?.display_name ?? user?.email}</h1>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <button className="rounded-full bg-surface-1 p-2"><Settings className="size-4" /></button>
      </header>

      <section className="mx-5 mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-card p-2 text-center">
        <Stat n={0} label="Saved" />
        <Stat n={0} label="Collections" />
        <Stat n={0} label="Following" />
      </section>

      <nav className="mt-5 px-5">
        <Item to="/profile/saved" icon={Bookmark} label="Saved places & videos" />
        <Item to="/profile/collections" icon={FolderHeart} label="Travel collections" />
        <Item to="/following" icon={Users} label="Creators you follow" />
        <Item to="/submit" icon={Plus} label="Submit a channel" />
      </nav>

      <div className="mt-6 px-5 pb-10">
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/" });
          }}
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>
    </MobileShell>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="py-2">
      <p className="font-display text-xl font-bold">{n}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
function Item({ to, icon: Icon, label }: { to: string; icon: typeof Bookmark; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl px-3 py-3 active:bg-surface-1">
      <div className="rounded-xl bg-surface-1 p-2"><Icon className="size-4" /></div>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className="text-muted-foreground">›</span>
    </Link>
  );
}

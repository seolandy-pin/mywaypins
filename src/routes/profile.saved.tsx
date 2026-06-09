import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/layout/MobileShell";
import { useAuth } from "@/lib/auth/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Bookmark, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/profile/saved")({
  head: () => ({ meta: [{ title: "Saved — WanderPins" }] }),
  component: SavedScreen,
});

function SavedScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<unknown[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("favorites").select("*").eq("user_id", user.id).then(({ data }) => setItems(data ?? []));
  }, [user]);
  return (
    <MobileShell>
      <header className="safe-top flex items-center gap-2 px-5 pt-4">
        <Link to="/profile" className="rounded-full p-1 active:bg-surface-1"><ChevronLeft className="size-5" /></Link>
        <h1 className="font-display text-xl font-bold">Saved</h1>
      </header>
      {items.length === 0 ? (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-6 text-center">
          <Bookmark className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nothing saved yet. Tap the bookmark on any video.</p>
        </div>
      ) : (
        <div className="px-5">{items.length} items</div>
      )}
    </MobileShell>
  );
}

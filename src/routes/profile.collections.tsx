import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/layout/MobileShell";
import { useAuth } from "@/lib/auth/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, FolderHeart, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile/collections")({
  head: () => ({ meta: [{ title: "Collections — WanderPins" }] }),
  component: CollectionsScreen,
});

type Collection = { id: string; name: string; description: string | null; cover_image_url: string | null };

function CollectionsScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<Collection[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    if (!user) return;
    const { data } = await supabase.from("collections").select("id,name,description,cover_image_url").eq("user_id", user.id).order("created_at", { ascending: false });
    setItems((data as Collection[]) ?? []);
  }
  useEffect(() => { refresh(); }, [user]);

  async function create() {
    if (!user || !name.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("collections").insert({ user_id: user.id, name: name.trim() });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setName("");
    refresh();
  }

  return (
    <MobileShell>
      <header className="safe-top flex items-center gap-2 px-5 pt-4">
        <Link to="/profile" className="rounded-full p-1 active:bg-surface-1"><ChevronLeft className="size-5" /></Link>
        <h1 className="font-display text-xl font-bold">Collections</h1>
      </header>
      <div className="mx-5 mt-4 flex gap-2 rounded-2xl bg-card p-2">
        <Input placeholder="Dream trip 2026…" value={name} onChange={(e) => setName(e.target.value)} className="bg-surface-1" />
        <Button onClick={create} disabled={creating || !name.trim()}><Plus className="size-4" /></Button>
      </div>
      <ul className="mt-4 space-y-2 px-5 pb-6">
        {items.length === 0 && (
          <li className="flex flex-col items-center gap-2 py-12 text-center">
            <FolderHeart className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Create your first travel collection above.</p>
          </li>
        )}
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-card p-3">
            <div className="size-12 rounded-xl bg-surface-2" />
            <div><p className="text-sm font-semibold">{c.name}</p></div>
          </li>
        ))}
      </ul>
    </MobileShell>
  );
}

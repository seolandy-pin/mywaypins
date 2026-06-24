import { createFileRoute, Link } from "@tanstack/react-router";

import { useAuth } from "@/lib/auth/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronDown, ChevronRight, FolderHeart, Plus, Trash2, Pencil, Check, X, Play } from "lucide-react";
import { toast } from "sonner";
import { deleteCollection, removeCollectionItem } from "@/lib/collections.functions";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";


export const Route = createFileRoute("/profile_/collections")({
  head: () => ({ meta: [{ title: "Collections — WanderPins" }] }),
  component: CollectionsScreen,
});

type Collection = { id: string; name: string; description: string | null; cover_image_url: string | null };
type CollectionVideo = {
  videoRowId: string;
  videoId: string;
  title: string;
  thumb: string | null;
};

function CollectionsScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<Collection[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [videosByCol, setVideosByCol] = useState<Record<string, CollectionVideo[]>>({});
  const [playing, setPlaying] = useState<CollectionVideo | null>(null);
  const deleteCollectionFn = useServerFn(deleteCollection);
  const removeItemFn = useServerFn(removeCollectionItem);


  async function refresh() {
    if (!user) return;
    const { data } = await supabase
      .from("collections")
      .select("id,name,description,cover_image_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const cols = (data as Collection[]) ?? [];
    setItems(cols);

    if (cols.length > 0) {
      const ids = cols.map((c) => c.id);
      const { data: ciData } = await supabase
        .from("collection_items")
        .select("collection_id")
        .in("collection_id", ids);
      const byCol: Record<string, number> = {};
      for (const row of (ciData ?? []) as { collection_id: string }[]) {
        byCol[row.collection_id] = (byCol[row.collection_id] ?? 0) + 1;
      }
      setCounts(byCol);
    }
  }
  useEffect(() => { refresh(); }, [user]);

  async function loadVideos(colId: string) {
    const { data } = await supabase
      .from("collection_items")
      .select("video_id, videos(id, youtube_video_id, title, thumbnail_url)")
      .eq("collection_id", colId);
    const rows: CollectionVideo[] = (data ?? [])
      .map((r) => {
        const v = (r as { videos: { id: string; youtube_video_id: string; title: string; thumbnail_url: string | null } | null }).videos;
        if (!v) return null;
        return { videoRowId: v.id, videoId: v.youtube_video_id, title: v.title, thumb: v.thumbnail_url };
      })
      .filter(Boolean) as CollectionVideo[];
    setVideosByCol((s) => ({ ...s, [colId]: rows }));
  }

  async function toggleExpand(colId: string) {
    if (expanded === colId) { setExpanded(null); return; }
    setExpanded(colId);
    if (!videosByCol[colId]) await loadVideos(colId);
  }

  async function create() {
    if (!user || !name.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("collections").insert({ user_id: user.id, name: name.trim() });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setName("");
    refresh();
  }

  async function removeCollection(id: string) {
    if (!confirm("Delete this folder and all its saved videos?")) return;
    try {
      await deleteCollectionFn({ data: { id } });
      setItems((s) => s.filter((c) => c.id !== id));
      setVideosByCol((s) => { const n = { ...s }; delete n[id]; return n; });
      toast.success("Folder deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function removeVideo(colId: string, videoRowId: string) {
    try {
      await removeItemFn({ data: { collectionId: colId, videoId: videoRowId } });
      setVideosByCol((s) => ({ ...s, [colId]: (s[colId] ?? []).filter((v) => v.videoRowId !== videoRowId) }));
      toast.success("Removed");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <header className="safe-top flex items-center gap-2 px-5 pt-4">
        <Link to="/profile" className="rounded-full p-1 active:bg-surface-1"><ChevronLeft className="size-5" /></Link>
        <h1 className="flex-1 font-display text-xl font-bold">Collections</h1>
        <button
          onClick={() => setEditing((e) => !e)}
          className="flex items-center gap-1 rounded-full bg-surface-1 px-3 py-1.5 text-xs font-medium active:bg-surface-2"
        >
          {editing ? <><Check className="size-3.5" /> Done</> : <><Pencil className="size-3.5" /> Edit</>}
        </button>
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
        {items.map((c) => {
          const isOpen = expanded === c.id;
          const vids = videosByCol[c.id] ?? [];
          return (
            <li key={c.id} className="overflow-hidden rounded-2xl bg-card">
              <div className="flex items-center gap-3 p-3">
                <button onClick={() => toggleExpand(c.id)} className="flex flex-1 items-center gap-3 text-left active:bg-surface-1 -m-1 p-1 rounded-xl">
                  <div className="size-12 rounded-xl bg-surface-2 flex items-center justify-center">
                    <FolderHeart className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {counts[c.id] ?? 0} video{(counts[c.id] ?? 0) === 1 ? "" : "s"} · Tap to {isOpen ? "collapse" : "view videos"}
                    </p>
                  </div>
                  {isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                </button>
                {editing && (
                  <button
                    onClick={() => removeCollection(c.id)}
                    className="flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-1.5 text-xs font-medium text-destructive active:bg-destructive/20"
                    aria-label="Delete folder"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
              {isOpen && (
                <ul className="border-t border-border bg-surface-1/40 px-3 py-2 space-y-2">
                  {vids.length === 0 ? (
                    <li className="py-3 text-center text-xs text-muted-foreground">No videos in this folder yet.</li>
                  ) : (
                    vids.map((v) => (
                      <li key={v.videoRowId} className="flex items-center gap-3 rounded-xl bg-card p-2">
                        <button
                          type="button"
                          onClick={() => setPlaying(v)}
                          className="flex flex-1 items-center gap-3 text-left active:opacity-80"
                        >
                          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-black">
                            {v.thumb ? <img src={v.thumb} alt="" className="size-full object-cover" /> : null}
                            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Play className="size-4 fill-white text-white" />
                            </span>
                          </div>
                          <p className="line-clamp-2 flex-1 text-xs font-medium">{v.title}</p>
                        </button>
                        {editing && (
                          <button
                            onClick={() => removeVideo(c.id, v.videoRowId)}
                            className="flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-1.5 text-xs font-medium text-destructive active:bg-destructive/20"
                            aria-label="Remove video"
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <Drawer open={!!playing} onOpenChange={(o) => { if (!o) setPlaying(null); }}>
        <DrawerContent className="bg-card text-card-foreground border-border max-h-[92vh]">
          <div className="mx-auto w-full max-w-[520px] overflow-y-auto">
            <DrawerHeader className="px-0 pt-0">
              <div className="relative aspect-video w-full overflow-hidden rounded-t-2xl bg-black">
                {playing && (
                  <iframe
                    className="size-full"
                    src={`https://www.youtube.com/embed/${playing.videoId}?autoplay=1&playsinline=1&rel=0`}
                    title={playing.title}
                    referrerPolicy="strict-origin-when-cross-origin"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                )}
              </div>
              <div className="px-5 pt-4 text-left">
                <DrawerTitle className="font-display text-base leading-tight">{playing?.title}</DrawerTitle>
                <DrawerDescription className="sr-only">YouTube video</DrawerDescription>
              </div>
            </DrawerHeader>
            <div className="px-5 pb-6 safe-bottom" />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );

}

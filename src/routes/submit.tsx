import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useAuth } from "@/lib/auth/use-auth";
import { submitChannel } from "@/lib/api/channels.functions";
import {
  createCollection,
  saveVideoToCollection,
} from "@/lib/collections.functions";
import { useMyCollections } from "@/lib/hooks/use-my-collections";
import { toast } from "sonner";
import { ChevronLeft, Youtube, Sparkles, FolderPlus, Film } from "lucide-react";

type SubmitSearch = { tab?: "channel" | "video" };

export const Route = createFileRoute("/submit")({
  head: () => ({ meta: [{ title: "Add to MyWayPins" }] }),
  validateSearch: (s: Record<string, unknown>): SubmitSearch => ({
    tab: s.tab === "video" ? "video" : "channel",
  }),
  component: SubmitScreen,
});

function SubmitScreen() {
  const navigate = useNavigate();
  const { tab = "channel" } = Route.useSearch();
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  if (!isAuthenticated) {
    return (
      <div className="safe-top flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Youtube className="size-10 text-primary" />
        <h2 className="font-display text-2xl font-bold">Sign in to continue</h2>
        <Button asChild size="lg"><Link to="/auth">Sign in</Link></Button>
      </div>
    );
  }

  return (
    <>
      <header className="safe-top flex items-center gap-2 px-5 pt-4">
        <Link to="/" className="rounded-full p-1 active:bg-surface-1"><ChevronLeft className="size-5" /></Link>
        <h1 className="font-display text-xl font-bold">Add to map</h1>
      </header>

      <div className="mx-5 mt-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-1 p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => navigate({ to: "/search" })}
          className={`rounded-lg py-2 ${tab === "channel" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          <Youtube className="mr-1 inline size-3.5" /> Channel
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: "/submit", search: { tab: "video" } })}
          className={`rounded-lg py-2 ${tab === "video" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          <Film className="mr-1 inline size-3.5" /> Single video
        </button>
      </div>

      {tab === "channel" ? <ChannelForm /> : <VideoForm />}
    </>
  );
}

function ChannelForm() {
  const navigate = useNavigate();
  const submit = useServerFn(submitChannel);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submit({ data: { channel_url: url.trim(), channel_name: name.trim() || undefined } });
      toast.success("Channel submitted! AI is extracting locations…");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mx-5 mt-4 flex gap-3 rounded-2xl gradient-hero p-4 text-primary-foreground">
        <Sparkles className="size-5 shrink-0" />
        <p className="text-sm">Our AI watches every video's title, description, and tags to pin it to the right place on the map.</p>
      </div>
      <form onSubmit={handleSubmit} className="mt-5 space-y-4 px-5">
        <div className="space-y-1.5">
          <Label htmlFor="url">YouTube channel URL</Label>
          <Input id="url" required placeholder="https://youtube.com/@channel" value={url} onChange={(e) => setUrl(e.target.value)} className="h-12 bg-surface-1" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Channel name (optional)</Label>
          <Input id="name" placeholder="Drew Binsky" value={name} onChange={(e) => setName(e.target.value)} className="h-12 bg-surface-1" />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy || !url}>{busy ? "Submitting…" : "Submit channel"}</Button>
      </form>
    </>
  );
}

function VideoForm() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { collections, refetch } = useMyCollections();
  const createFn = useServerFn(createCollection);
  const saveFn = useServerFn(saveVideoToCollection);

  const [videoUrl, setVideoUrl] = useState("");
  const [collectionId, setCollectionId] = useState<string>("");
  const [newFolder, setNewFolder] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!newFolder.trim()) return;
    setCreating(true);
    try {
      const row = await createFn({ data: { name: newFolder.trim() } });
      toast.success(`Folder "${row.name}" created`);
      setNewFolder("");
      await refetch();
      setCollectionId(row.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create folder");
    } finally {
      setCreating(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!collectionId) {
      toast.error("Pick or create a folder first");
      return;
    }
    setSaving(true);
    try {
      const r = await saveFn({ data: { videoUrl: videoUrl.trim(), collectionId } });
      toast.success(`Saved! ${r.pins} location${r.pins === 1 ? "" : "s"} pinned.`);
      qc.invalidateQueries({ queryKey: ["my-collections"] });
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save video");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mx-5 mt-4 flex gap-3 rounded-2xl gradient-hero p-4 text-primary-foreground">
        <Sparkles className="size-5 shrink-0" />
        <p className="text-sm">Paste a YouTube video link. AI finds every location mentioned and pins it on your map.</p>
      </div>

      <div className="mx-5 mt-5 rounded-2xl bg-card p-4">
        <Label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">New folder</Label>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Italy 2026"
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            className="h-10 bg-surface-1"
          />
          <Button type="button" onClick={handleCreate} disabled={creating || !newFolder.trim()}>
            <FolderPlus className="size-4" />
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave} className="mt-4 space-y-4 px-5">
        <div className="space-y-1.5">
          <Label htmlFor="vurl">YouTube video URL</Label>
          <Input id="vurl" required placeholder="https://youtube.com/watch?v=..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="h-12 bg-surface-1" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="folder">Save to folder</Label>
          {collections.length === 0 ? (
            <p className="text-xs text-muted-foreground">Create a folder above first.</p>
          ) : (
            <select
              id="folder"
              required
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              className="flex h-12 w-full rounded-md border border-input bg-surface-1 px-3 text-sm"
            >
              <option value="">Pick a folder…</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={saving || !videoUrl || !collectionId}>
          {saving ? "Saving…" : "Save video to map"}
        </Button>
      </form>
    </>
  );
}

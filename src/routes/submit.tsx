import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient, useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/use-auth";
import { submitChannel } from "@/lib/api/channels.functions";
import {
  createCollection,
  saveVideoToCollection,
} from "@/lib/collections.functions";
import { useMyCollections } from "@/lib/hooks/use-my-collections";
import { toast } from "sonner";
import { ChevronLeft, Youtube, Sparkles, FolderPlus, Film, Search as SearchIcon, MapPin } from "lucide-react";
import { searchYouTubeChannelsFn } from "@/lib/youtube.functions";
import { samplePins, featuredDestinations, popularCreators } from "@/lib/sample-data";


function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

type SubmitSearch = { tab?: "channel" | "video" };

export const Route = createFileRoute("/submit")({
  head: () => ({ meta: [{ title: "Add to MyWayPins" }] }),
  validateSearch: (s: Record<string, unknown>): SubmitSearch => ({
    tab: s.tab === "channel" ? "channel" : "video",
  }),
  component: SubmitScreen,
});

function SubmitScreen() {
  const navigate = useNavigate();
  const { tab = "video" } = Route.useSearch();
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
          onClick={() => navigate({ to: "/submit", search: { tab: "channel" } })}
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

      {tab === "channel" ? <ChannelSearchPanel /> : <VideoForm />}
    </>
  );
}

function ChannelSearchPanel() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const ytSearch = useServerFn(searchYouTubeChannelsFn);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const ytQuery = useQuery({
    queryKey: ["yt-search", debounced],
    enabled: debounced.length >= 2,
    staleTime: 1000 * 60 * 10,
    retry: false,
    queryFn: () => ytSearch({ data: { q: debounced } }),
  });

  useEffect(() => {
    const err = ytQuery.error;
    if (!err) return;
    const msg = (err as Error).message ?? "";
    if (msg.includes("QUOTA") || msg.includes("403") || msg.includes("429")) {
      toast.error("YouTube API daily quota exceeded. Please try again later.");
    }
  }, [ytQuery.error]);


  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return null;
    return {
      places: featuredDestinations.filter((d) => `${d.name} ${d.country}`.toLowerCase().includes(term)),
      creators: popularCreators.filter((c) => c.name.toLowerCase().includes(term)),
      videos: samplePins.filter((p) => `${p.title} ${p.location} ${p.creator}`.toLowerCase().includes(term)),
    };
  }, [q]);

  return (
    <>
      <div className="px-5 pt-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search YouTube channels, places…"
            className="h-12 rounded-2xl bg-surface-1 pl-10 text-base"
          />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Youtube className="size-3.5 text-primary" /> Tip: try a place like "Japan" to see top travel videos.
        </p>
      </div>

      {!results && (
        <section className="mt-6 px-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Suggested</h2>
          <div className="flex flex-wrap gap-2">
            {["Japan", "Iceland", "Bali", "Patagonia", "Morocco", "Vietnam", "Peru"].map((s) => (
              <button
                key={s}
                onClick={() => setQ(s)}
                className="rounded-full bg-surface-1 px-4 py-2 text-sm font-medium active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
        </section>
      )}

      {results && (
        <div className="mt-4 space-y-6 px-5 pb-6">



          <SearchGroup title="YouTube channels">
            {debounced.length < 2 && <p className="text-xs text-muted-foreground">Type at least 2 characters…</p>}
            {debounced.length >= 2 && ytQuery.isLoading && <p className="text-sm text-muted-foreground">Searching…</p>}
            {ytQuery.error && <p className="text-sm text-destructive">Couldn't reach YouTube.</p>}
            {ytQuery.data && ytQuery.data.length === 0 && <SearchEmpty />}
            {ytQuery.data?.map((c) => {
              const handle = c.customUrl;
              const subtitle = c.subscriberCount === null ? "Subscribers hidden" : `${formatNum(c.subscriberCount)} subscribers`;
              if (handle) {
                return (
                  <Link
                    key={c.id}
                    to="/channel/$handle"
                    params={{ handle }}
                    className="flex items-center gap-3 rounded-2xl bg-card p-3 active:scale-[0.98]"
                  >
                    <img src={c.thumbnail} alt="" className="size-12 shrink-0 rounded-full object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-semibold">{c.title}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">@{handle} · {subtitle}</p>
                    </div>
                  </Link>
                );
              }
              return (
                <a
                  key={c.id}
                  href={`https://www.youtube.com/channel/${c.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl bg-card p-3 active:scale-[0.98]"
                >
                  <img src={c.thumbnail} alt="" className="size-12 shrink-0 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-semibold">{c.title}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">Open on YouTube · {subtitle}</p>
                  </div>
                </a>
              );
            })}
          </SearchGroup>

          <SearchGroup title="Places">
            {results.places.length === 0 && <SearchEmpty />}
            {results.places.map((p) => (
              <SearchRow key={p.name} title={p.name} subtitle={`${p.country} · ${p.videos} videos`} img={p.image} />
            ))}
          </SearchGroup>
          <SearchGroup title="Creators">
            {results.creators.length === 0 && <SearchEmpty />}
            {results.creators.map((c) => (
              <SearchRow key={c.name} title={c.name} subtitle={`${c.subs} subscribers`} img={c.avatar} round />
            ))}
          </SearchGroup>
          <SearchGroup title="Videos">
            {results.videos.length === 0 && <SearchEmpty />}
            {results.videos.map((v) => (
              <SearchRow key={v.id} title={v.title} subtitle={`${v.creator} · ${v.location}`} img={v.thumbnail} />
            ))}
          </SearchGroup>
        </div>
      )}

    </>
  );
}

function SearchGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function SearchRow({ title, subtitle, img, round }: { title: string; subtitle: string; img: string; round?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-3">
      <img src={img} alt="" className={`${round ? "size-12 rounded-full" : "size-14 rounded-xl"} shrink-0 object-cover`} />
      <div className="min-w-0">
        <p className="line-clamp-1 text-sm font-semibold">{title}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground"><MapPin className="mr-1 inline size-3" />{subtitle}</p>
      </div>
    </div>
  );
}
function SearchEmpty() {
  return <p className="text-sm text-muted-foreground">No matches.</p>;
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
    const trimmed = videoUrl.trim();
    if (/youtube\.com\/(@|channel\/|c\/|user\/)/i.test(trimmed)) {
      toast.error("That's a channel URL. Paste a single video link (youtube.com/watch?v=... or youtu.be/...).");
      return;
    }
    setSaving(true);
    try {
      const r = await saveFn({ data: { videoUrl: trimmed, collectionId } });
      toast.success(`Saved! ${r.pins} location${r.pins === 1 ? "" : "s"} pinned.`);
      qc.invalidateQueries({ queryKey: ["my-collections"] });
      qc.invalidateQueries({ queryKey: ["pins"] });
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

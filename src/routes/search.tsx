import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Input } from "@/components/ui/input";
import { Search as SearchIcon, MapPin, Youtube } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { samplePins, featuredDestinations, popularCreators } from "@/lib/sample-data";
import { searchYouTubeChannelsFn } from "@/lib/youtube.functions";


export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — WanderPins" },
      { name: "description", content: "Search countries, cities, landmarks, creators and travel videos." },
    ],
  }),
  component: SearchScreen,
});

function formatNum(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

function SearchScreen() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeVideo, setActiveVideo] = useState<YTVideoResult | null>(null);
  const ytSearch = useServerFn(searchYouTubeChannelsFn);
  const ytVideosSearch = useServerFn(searchYouTubeVideosFn);

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

  const ytVideosQuery = useQuery({
    queryKey: ["yt-videos-search", debounced],
    enabled: debounced.length >= 2,
    staleTime: 1000 * 60 * 30,
    retry: false,
    queryFn: () => ytVideosSearch({ data: { q: debounced } }),
  });

  useEffect(() => {
    const err = ytQuery.error || ytVideosQuery.error;
    if (!err) return;
    const msg = (err as Error).message ?? "";
    if (msg.includes("QUOTA") || msg.includes("403") || msg.includes("429")) {
      toast.error("YouTube API daily quota exceeded. Please try again later.");
    } else {
      toast.error("Something went wrong while searching. Please try again later.");
    }
  }, [ytQuery.error, ytVideosQuery.error]);

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
      <header className="safe-top px-5 pt-4">
        <h1 className="font-display text-2xl font-bold">Search</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDebounced(q.trim());
          }}
          className="relative mt-3"
        >
          <button
            type="submit"
            aria-label="Search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <SearchIcon className="size-4" />
          </button>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search places, creators, videos…"
            className="h-12 rounded-2xl bg-surface-1 pl-10 text-base"
          />
        </form>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Youtube className="size-3.5 text-primary" /> Tip: try a place like "Japan" to see top travel videos.
        </p>
      </header>

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
          <Group title="Popular videos">
            {debounced.length < 2 && <p className="text-xs text-muted-foreground">Type at least 2 characters…</p>}
            {debounced.length >= 2 && ytVideosQuery.isLoading && <p className="text-sm text-muted-foreground">Searching popular videos…</p>}
            {ytVideosQuery.data && ytVideosQuery.data.length === 0 && <Empty />}
            <div className="grid grid-cols-2 gap-3">
              {ytVideosQuery.data?.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setActiveVideo(v)}
                  className="overflow-hidden rounded-2xl bg-card text-left active:scale-[0.98]"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-black">
                    <img src={v.thumbnail} alt="" className="size-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                      <Play className="size-8 fill-white text-white" />
                    </div>
                    {v.viewCount != null && (
                      <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                        <Eye className="size-3" />
                        {formatNum(v.viewCount)}
                      </span>
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="line-clamp-2 text-xs font-semibold leading-snug">{v.title}</p>
                    <p className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">{v.channelTitle}</p>
                  </div>
                </button>
              ))}
            </div>
          </Group>

          <Group title="YouTube channels">
            {debounced.length >= 2 && ytQuery.isLoading && <p className="text-sm text-muted-foreground">Searching…</p>}
            {ytQuery.data && ytQuery.data.length === 0 && <Empty />}
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
          </Group>

          <Group title="Places">
            {results.places.length === 0 && <Empty />}
            {results.places.map((p) => (
              <Row key={p.name} title={p.name} subtitle={`${p.country} · ${p.videos} videos`} img={p.image} />
            ))}
          </Group>
          <Group title="Creators">
            {results.creators.length === 0 && <Empty />}
            {results.creators.map((c) => (
              <Row key={c.name} title={c.name} subtitle={`${c.subs} subscribers`} img={c.avatar} round />
            ))}
          </Group>
        </div>
      )}

      <SearchVideoSheet
        video={activeVideo}
        open={!!activeVideo}
        onOpenChange={(o) => { if (!o) setActiveVideo(null); }}
      />
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Row({ title, subtitle, img, round }: { title: string; subtitle: string; img: string; round?: boolean }) {
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
function Empty() {
  return <p className="text-sm text-muted-foreground">No matches.</p>;
}

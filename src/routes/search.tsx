import { createFileRoute } from "@tanstack/react-router";

import { Input } from "@/components/ui/input";
import { Search as SearchIcon, MapPin } from "lucide-react";
import { useState, useMemo } from "react";
import { samplePins, featuredDestinations, popularCreators } from "@/lib/sample-data";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — WanderPins" },
      { name: "description", content: "Search countries, cities, landmarks, creators and travel videos." },
    ],
  }),
  component: SearchScreen,
});

function SearchScreen() {
  const [q, setQ] = useState("");

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
        <div className="relative mt-3">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tokyo, Iceland, creators…"
            className="h-12 rounded-2xl bg-surface-1 pl-10 text-base"
          />
        </div>
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
          <Group title="Videos">
            {results.videos.length === 0 && <Empty />}
            {results.videos.map((v) => (
              <Row key={v.id} title={v.title} subtitle={`${v.creator} · ${v.location}`} img={v.thumbnail} />
            ))}
          </Group>
        </div>
      )}
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

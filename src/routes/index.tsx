import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MobileShell } from "@/components/layout/MobileShell";
import { MapView } from "@/components/MapView";
import { VideoSheet } from "@/components/VideoSheet";
import { featuredDestinations, samplePins, PIN_TYPE_COLORS } from "@/lib/sample-data";
import { usePopularCreators } from "@/lib/hooks/use-youtube-creators";
import type { SamplePin } from "@/lib/sample-data";
import { useState } from "react";
import { Compass, TrendingUp, Sparkles, MapPin, Plus, Maximize2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WanderPins — Discover travel through the map" },
      { name: "description", content: "Explore travel YouTube videos pinned to real places around the world." },
      { property: "og:title", content: "WanderPins" },
      { property: "og:description", content: "Google Maps meets YouTube for travel discovery." },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [activePin, setActivePin] = useState<SamplePin | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { creators: popularCreators, loading: creatorsLoading } = usePopularCreators();


  return (
    <MobileShell>
      <header className="safe-top flex items-center justify-between px-5 pb-2 pt-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Welcome to</p>
          <h1 className="font-display text-3xl font-bold leading-none">WanderPins</h1>
        </div>
        <Link to="/submit" className="flex size-10 items-center justify-center rounded-full bg-surface-1 active:scale-95">
          <Plus className="size-5" />
        </Link>
      </header>

      <section className="mx-5 mt-4">
        <div className="relative h-[55vh] min-h-[320px] w-full overflow-hidden rounded-3xl border border-border bg-surface-1 shadow-xl">
          <MapView
            onPinClick={(p) => {
              setActivePin(p);
              setSheetOpen(true);
            }}
          />
          <div className="glass pointer-events-none absolute inset-x-3 top-3 flex items-center gap-2 rounded-2xl border border-border/60 px-3 py-2">
            <Compass className="size-4 text-primary" />
            <span className="font-display text-sm font-semibold">Explore the world</span>
            <div className="ml-auto flex items-center gap-2 text-[10px]">
              {(["trending", "new", "featured", "traveling"] as const).map((t) => (
                <span key={t} className="flex items-center gap-1 capitalize text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: PIN_TYPE_COLORS[t] }} />
                  {t}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => navigate({ to: "/map" })}
            className="glass absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-2 text-xs font-semibold active:scale-95"
          >
            <Maximize2 className="size-3.5" /> Full map
          </button>
        </div>
        <VideoSheet pin={activePin} open={sheetOpen} onOpenChange={setSheetOpen} />
      </section>


      <Section title="Featured destinations" icon={Sparkles}>
        <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5">
          {featuredDestinations.map((d) => (
            <article key={d.name} className="w-44 shrink-0 overflow-hidden rounded-2xl bg-card">
              <div className="aspect-[4/5] overflow-hidden">
                <img src={d.image} alt={d.name} loading="lazy" className="size-full object-cover transition hover:scale-105" />
              </div>
              <div className="p-3">
                <h3 className="font-display text-base font-bold leading-tight">{d.name}</h3>
                <p className="text-xs text-muted-foreground">{d.country} · {d.videos} videos</p>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Trending now" icon={TrendingUp}>
        <ul className="space-y-3">
          {samplePins.slice(0, 3).map((p) => (
            <li key={p.id} className="flex gap-3 rounded-2xl bg-card p-3">
              <img src={p.thumbnail} alt={p.title} className="size-20 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{p.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{p.creator}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" /> {p.location} · {p.views}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Popular creators">
        <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-4">
          {popularCreators.map((c) => (
            <div key={c.name} className="flex w-20 shrink-0 flex-col items-center text-center">
              <div className="relative">
                <img src={c.avatar} alt={c.name} className="size-16 rounded-full object-cover ring-2 ring-border" />
                {c.traveling && (
                  <span className="absolute -bottom-1 right-0 size-4 rounded-full border-2 border-background bg-pin-traveling" title={`In ${c.traveling}`} />
                )}
              </div>
              <p className="mt-1.5 line-clamp-1 text-xs font-medium">{c.name}</p>
              <p className="text-[10px] text-muted-foreground">{creatorsLoading ? "…" : `${c.subs} subs`}</p>
            </div>
          ))}
        </div>
      </Section>
    </MobileShell>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof Sparkles; children: React.ReactNode }) {
  return (
    <section className="mt-6 px-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
        {Icon && <Icon className="size-4 text-primary" />} {title}
      </h2>
      {children}
    </section>
  );
}

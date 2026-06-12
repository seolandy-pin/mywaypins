import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import { samplePins, PIN_TYPE_COLORS, type SamplePin } from "@/lib/sample-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Key } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const TOKEN_KEY = "wanderpins:mapbox_token";
export const SAVED_PIN_COLOR = "#ff7350";
export const FAVORITES_CHANGED_EVENT = "wanderpins:favorites-changed";

type PinType = SamplePin["type"];
const ALLOWED_PIN_TYPES: PinType[] = ["trending", "new", "featured", "traveling"];

async function fetchSavedPinIds(): Promise<Set<string>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data } = await supabase
    .from("favorites")
    .select("pin_id")
    .eq("user_id", user.id)
    .eq("target_type", "pin");
  return new Set(((data ?? []).map((r) => r.pin_id).filter(Boolean)) as string[]);
}

// Pin enriched with the owning channel's avatar so map markers can show it.
export type MapPin = SamplePin & { avatar?: string | null };

async function fetchIngestedPins(channelIds?: string[], videoIds?: string[]): Promise<MapPin[]> {
  if (videoIds && videoIds.length === 0) return [];
  if (!videoIds && channelIds && channelIds.length === 0) return [];
  let q = supabase
    .from("pins")
    .select(
      "id, latitude, longitude, label, pin_type, channel_id, youtube_channels(name, thumbnail_url), videos(youtube_video_id, title, thumbnail_url, published_at), places(city_name, country_name)",
    )
    .limit(1000);
  if (videoIds) {
    q = q.in("video_id", videoIds);
  } else if (channelIds) {
    q = q.in("channel_id", channelIds);
  }
  const { data, error } = await q;
  if (error || !data) return [];
  return data
    .filter((p) => typeof p.latitude === "number" && typeof p.longitude === "number")
    .map((p): MapPin => {
      const v = (p as { videos: { youtube_video_id?: string; title?: string; thumbnail_url?: string; published_at?: string } | null }).videos;
      const ch = (p as { youtube_channels: { name?: string; thumbnail_url?: string } | null }).youtube_channels;
      const place = (p as { places: { city_name?: string; country_name?: string } | null }).places;
      const type = (ALLOWED_PIN_TYPES as string[]).includes(p.pin_type) ? (p.pin_type as PinType) : "new";
      return {
        id: p.id,
        lat: p.latitude as number,
        lng: p.longitude as number,
        type,
        title: v?.title ?? p.label ?? "Untitled",
        creator: ch?.name ?? "Unknown",
        thumbnail: v?.thumbnail_url ?? "",
        location: [place?.city_name, place?.country_name].filter(Boolean).join(", ") || (p.label ?? ""),
        views: "",
        uploaded: v?.published_at ? new Date(v.published_at).toLocaleDateString() : "",
        youtubeId: v?.youtube_video_id ?? "",
        avatar: ch?.thumbnail_url ?? null,
      };
    });
}

function getStoredToken(): string {
  if (typeof window === "undefined") return "";
  return (
    (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string) ||
    (import.meta.env.VITE_MAPBOX_TOKEN as string) ||
    localStorage.getItem(TOKEN_KEY) ||
    ""
  );
}

// ----- Singleton map kept across route changes to avoid re-mount flicker -----
type PinHandler = (p: SamplePin) => void;
let sharedDiv: HTMLDivElement | null = null;
let sharedMap: mapboxgl.Map | null = null;
const sharedHandlerRef: { current: PinHandler } = { current: () => {} };
let currentPins: MapPin[] = [];
let currentSavedIds: Set<string> = new Set();
const PIN_SOURCE_ID = "wanderpins-source";

function pinsToGeoJSON(pins: SamplePin[], savedIds: Set<string>): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: pins.map((p) => {
      const saved = savedIds.has(p.id);
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          color: saved ? SAVED_PIN_COLOR : PIN_TYPE_COLORS[p.type],
          saved,
          pin: JSON.stringify(p),
        },
      };
    }),
  };
}

function setPinData(map: mapboxgl.Map, pins: MapPin[], savedIds?: Set<string>) {
  currentPins = pins;
  if (savedIds) currentSavedIds = savedIds;
  const src = map.getSource(PIN_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
  if (src) src.setData(pinsToGeoJSON(pins, currentSavedIds));
  renderHtmlMarkers(map);
}

// Every pin is rendered as an HTML marker showing the channel's avatar
// (falls back to a small colored dot when no avatar exists).
type MarkerEntry = { marker: mapboxgl.Marker; el: HTMLButtonElement; saved: boolean; pin: MapPin };
const htmlMarkerMap = new Map<string, MarkerEntry>();

function buildMarkerHtml(p: MapPin, saved: boolean): string {
  const border = saved ? SAVED_PIN_COLOR : "#ffffff";
  return p.avatar
    ? `<div style="width:34px;height:34px;border-radius:9999px;overflow:hidden;border:2px solid ${border};box-shadow:0 3px 8px rgba(0,0,0,.55);background:#222;"><img src="${p.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" /></div>`
    : `<div style="width:18px;height:18px;border-radius:9999px;border:2.5px solid ${border};box-shadow:0 2px 6px rgba(0,0,0,.5);background:${saved ? SAVED_PIN_COLOR : PIN_TYPE_COLORS[p.type]};"></div>`;
}

function renderHtmlMarkers(map: mapboxgl.Map) {
  // Diff-based update: keep existing marker DOM nodes for pins that are still
  // present, only remove ones that have gone away and add genuinely new ones.
  // This avoids the full remove/re-add cycle that causes a visible blink when
  // selecting a channel filter.
  const nextIds = new Set(currentPins.map((p) => p.id));

  // Remove markers no longer present.
  for (const [id, entry] of htmlMarkerMap) {
    if (!nextIds.has(id)) {
      entry.marker.remove();
      htmlMarkerMap.delete(id);
    }
  }

  for (const p of currentPins) {
    const saved = currentSavedIds.has(p.id);
    const existing = htmlMarkerMap.get(p.id);
    if (existing) {
      // Reuse: update DOM only if saved state changed.
      if (existing.saved !== saved) {
        existing.el.innerHTML = buildMarkerHtml(p, saved);
        existing.saved = saved;
      }
      existing.pin = p;
      // IMPORTANT: only re-attach if detached — Marker.addTo() internally
      // removes + re-adds the DOM node, which causes a visible flash.
      if (!existing.el.isConnected) existing.marker.addTo(map);
      continue;
    }
    const el = document.createElement("button");
    el.type = "button";
    el.className = "wp-channel-marker";
    el.style.cssText = "display:block;cursor:pointer;background:transparent;border:0;padding:0;";
    el.innerHTML = buildMarkerHtml(p, saved);
    const entry: MarkerEntry = {
      // occludedOpacity: 0 fully hides markers on the back of the globe so
      // channel icons don't faintly flicker in/out in empty regions as the
      // camera moves (Mapbox v3 default is 0.2, which causes the ghosting).
      marker: new mapboxgl.Marker({ element: el, anchor: "center", occludedOpacity: 0 })
        .setLngLat([p.lng, p.lat])
        .addTo(map),
      el,
      saved,
      pin: p,
    };
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      sharedHandlerRef.current(entry.pin);
    });
    htmlMarkerMap.set(p.id, entry);
  }
}

function setupPinLayers(map: mapboxgl.Map) {
  if (map.getSource(PIN_SOURCE_ID)) return;

  map.addSource(PIN_SOURCE_ID, {
    type: "geojson",
    data: pinsToGeoJSON([], new Set()),
    cluster: true,
    clusterRadius: 30,
    clusterMaxZoom: 6,
  });

  // All circle/cluster layers are hidden — pins render as HTML avatar
  // markers instead (see renderHtmlMarkers).
  map.addLayer({
    id: "wp-clusters",
    type: "circle",
    source: PIN_SOURCE_ID,
    filter: ["has", "point_count"],
    layout: { visibility: "none" },
    paint: {
      "circle-color": "#5b8def",
      "circle-opacity": 0.9,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
      "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 50, 30],
    },
  });
  map.addLayer({
    id: "wp-cluster-count",
    type: "symbol",
    source: PIN_SOURCE_ID,
    filter: ["has", "point_count"],
    layout: {
      visibility: "none",
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
      "text-size": 13,
      "text-allow-overlap": true,
    },
    paint: { "text-color": "#ffffff" },
  });

  map.addLayer({
    id: "wp-pin-hit",
    type: "circle",
    source: PIN_SOURCE_ID,
    filter: ["!", ["has", "point_count"]],
    layout: { visibility: "none" },
    paint: {
      "circle-color": "#000",
      "circle-opacity": 0,
      "circle-radius": 18,
    },
  });

  map.addLayer({
    id: "wp-pin",
    type: "circle",
    source: PIN_SOURCE_ID,
    filter: ["!", ["has", "point_count"]],
    layout: { visibility: "none" },
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": ["case", ["==", ["get", "saved"], true], 11, 9],
      "circle-stroke-color": ["case", ["==", ["get", "saved"], true], "#fef9c3", "#ffffff"],
      "circle-stroke-width": ["case", ["==", ["get", "saved"], true], 3.5, 2.5],
    },
  });

  map.on("click", "wp-clusters", (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ["wp-clusters"] });
    const clusterId = features[0]?.properties?.cluster_id;
    const src = map.getSource(PIN_SOURCE_ID) as mapboxgl.GeoJSONSource;
    if (clusterId == null) return;
    src.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err || zoom == null) return;
      const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
      map.easeTo({ center: coords, zoom: Math.max(zoom, map.getZoom() + 1.5) });
    });
  });

  const handlePinClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
    const f = e.features?.[0];
    if (!f) return;
    try {
      const pin = JSON.parse(f.properties?.pin as string) as SamplePin;
      sharedHandlerRef.current(pin);
    } catch {/* noop */}
  };
  map.on("click", "wp-pin", handlePinClick);
  map.on("click", "wp-pin-hit", handlePinClick);

  const setCursor = (c: string) => () => (map.getCanvas().style.cursor = c);
  map.on("mouseenter", "wp-clusters", setCursor("pointer"));
  map.on("mouseleave", "wp-clusters", setCursor(""));
  map.on("mouseenter", "wp-pin-hit", setCursor("pointer"));
  map.on("mouseleave", "wp-pin-hit", setCursor(""));
}

function boostLabelLegibility(map: mapboxgl.Map) {
  const style = map.getStyle();
  style?.layers?.forEach((layer) => {
    if (layer.type !== "symbol") return;
    const id = layer.id;
    if (id.includes("country-label")) {
      map.setLayoutProperty(id, "text-size", [
        "interpolate", ["linear"], ["zoom"],
        1, 12, 4, 18, 6, 22,
      ]);
      map.setPaintProperty(id, "text-color", "#ffffff");
      map.setPaintProperty(id, "text-halo-color", "#0b0d12");
      map.setPaintProperty(id, "text-halo-width", 1.6);
    } else if (id.includes("state-label") || id.includes("settlement-major-label")) {
      map.setPaintProperty(id, "text-color", "#e6e8ee");
      map.setPaintProperty(id, "text-halo-color", "#0b0d12");
      map.setPaintProperty(id, "text-halo-width", 1.4);
    }
  });
}

let lastFetchSig = "";
let fetchSeq = 0;
// Cache fetched pin sets per filter signature so re-selecting a channel shows
// its markers instantly (no blank flash while the network request is in flight).
const pinCache = new Map<string, MapPin[]>();
function renderPins(map: mapboxgl.Map, channelIds?: string[], videoIds?: string[]) {
  const base = !channelIds && !videoIds ? [...samplePins] : [];
  const sig = `c:${channelIds?.join(",") ?? "*"}|v:${videoIds?.join(",") ?? "*"}`;
  // Same filter as last fetch and we already have data → just ensure markers
  // exist on this map instance (route remount) without re-fetching/re-flickering.
  if (sig === lastFetchSig && currentPins.length > 0) {
    renderHtmlMarkers(map);
    return;
  }
  if (sig !== lastFetchSig) {
    // Filter changed. If we have cached pins for this filter, swap to them
    // immediately. Otherwise KEEP the previous markers visible while the new
    // fetch is in flight — clearing first causes a visible blank/flicker.
    // `renderHtmlMarkers` diffs old → new when the fetch resolves, so pins
    // not in the new filter are removed in a single seamless swap.
    const cached = pinCache.get(sig);
    if (cached) {
      setPinData(map, cached);
    } else if (channelIds?.length === 0 || videoIds?.length === 0) {
      // Nothing to fetch (no filter selected) → clear right away.
      setPinData(map, base);
    }
    // else: leave existing markers in place until the fetch completes.
  }
  lastFetchSig = sig;
  const mySeq = ++fetchSeq;
  Promise.all([fetchIngestedPins(channelIds, videoIds), fetchSavedPinIds()])
    .then(([pins, savedIds]) => {
      // Drop stale responses if another filter change happened in the meantime.
      if (mySeq !== fetchSeq) return;
      const all = [...base, ...pins];
      pinCache.set(sig, all);
      setPinData(map, all, savedIds);
    })
    .catch((e) => console.warn("[map] failed to load ingested pins", e));
}

function refreshSavedHighlight(map: mapboxgl.Map) {
  fetchSavedPinIds()
    .then((savedIds) => setPinData(map, currentPins, savedIds))
    .catch(() => {/* noop */});
}

function ensureSharedMap(token: string) {
  if (sharedDiv && sharedMap) return { div: sharedDiv, map: sharedMap };
  mapboxgl.accessToken = token;

  const div = document.createElement("div");
  div.style.cssText = "width:100%;height:100%;";
  sharedDiv = div;

  const hiddenHost = document.createElement("div");
  hiddenHost.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;";
  hiddenHost.appendChild(div);
  document.body.appendChild(hiddenHost);

  const map = new mapboxgl.Map({
    container: div,
    style: "mapbox://styles/mapbox/satellite-streets-v12",
    center: [20, 30],
    zoom: 1.6,
    projection: { name: "globe" },
    attributionControl: false,
  });
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

  map.on("style.load", () => {
    map.setFog({
      color: "rgb(186, 210, 235)",
      "high-color": "rgb(36, 92, 223)",
      "horizon-blend": 0.02,
      "space-color": "rgb(11, 13, 18)",
      "star-intensity": 0.6,
    });
  });

  map.on("load", () => {
    boostLabelLegibility(map);
    setupPinLayers(map);
  });

  sharedMap = map;
  return { div, map };
}

export type ChannelMarkerData = {
  channelId: string;
  name: string;
  thumbnail: string | null;
  location: string;
  lat: number;
  lng: number;
};

export function MapView({
  onPinClick,
  followedChannelIds,
  videoIdsFilter,
  pinsRefreshKey = 0,
}: {
  onPinClick: (pin: SamplePin) => void;
  followedChannelIds?: string[];
  videoIdsFilter?: string[];
  pinsRefreshKey?: number;
  channelMarkers?: ChannelMarkerData[];
  onChannelMarkerClick?: (channelId: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState<string>("");
  const [tokenInput, setTokenInput] = useState("");
  const loadedRef = useRef(false);

  useEffect(() => {
    setToken(getStoredToken());
  }, []);

  useEffect(() => {
    sharedHandlerRef.current = onPinClick;
  }, [onPinClick]);

  // Attach the shared map div ONCE per mount. This effect must NOT depend on
  // the filter props — re-running it detaches + re-appends the map container,
  // which blinks the whole map (and every channel icon) on each channel click.
  useEffect(() => {
    if (!token || !hostRef.current) return;
    const { div, map } = ensureSharedMap(token);
    const host = hostRef.current;
    if (div.parentElement !== host) host.appendChild(div);
    requestAnimationFrame(() => map.resize());

    const onFavoritesChanged = () => refreshSavedHighlight(map);
    window.addEventListener(FAVORITES_CHANGED_EVENT, onFavoritesChanged);

    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, onFavoritesChanged);
      if (div.parentElement === host) host.removeChild(div);
    };
  }, [token]);

  // Render pins when filters change — without touching the map container DOM.
  useEffect(() => {
    if (!token) return;
    const map = sharedMap;
    if (!map) return;

    const render = () => {
      setupPinLayers(map);
      renderPins(map, followedChannelIds, videoIdsFilter);
    };
    if (!loadedRef.current && !map.loaded()) {
      map.once("load", () => {
        loadedRef.current = true;
        render();
      });
    } else {
      loadedRef.current = true;
      render();
    }
  }, [token, followedChannelIds?.join(","), videoIdsFilter?.join(","), pinsRefreshKey]);




  if (!token) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="rounded-2xl bg-surface-2 p-4">
          <Key className="size-8 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Add your Mapbox token</h2>
          <p className="mt-2 text-sm text-muted-foreground text-balance">
            Get a free token from{" "}
            <a className="text-primary underline" href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noreferrer">
              account.mapbox.com
            </a>{" "}
            and paste it below to unlock the world map.
          </p>
        </div>
        <div className="flex w-full max-w-sm gap-2">
          <Input
            placeholder="pk.eyJ1Ijo…"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
          />
          <Button
            onClick={() => {
              if (!tokenInput.startsWith("pk.")) return;
              localStorage.setItem(TOKEN_KEY, tokenInput.trim());
              setToken(tokenInput.trim());
            }}
          >
            Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Stored locally on this device.</p>
      </div>
    );
  }

  return <div ref={hostRef} className="size-full" />;
}

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import { samplePins, PIN_TYPE_COLORS, type SamplePin } from "@/lib/sample-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Key } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const TOKEN_KEY = "wanderpins:mapbox_token";

type PinType = SamplePin["type"];
const ALLOWED_PIN_TYPES: PinType[] = ["trending", "new", "featured", "traveling"];

async function fetchIngestedPins(channelIds?: string[]): Promise<SamplePin[]> {
  let q = supabase
    .from("pins")
    .select(
      "id, latitude, longitude, label, pin_type, channel_id, videos(youtube_video_id, title, thumbnail_url, published_at, youtube_channels(name)), places(city_name, country_name)",
    )
    .limit(1000);
  if (channelIds && channelIds.length > 0) {
    q = q.in("channel_id", channelIds);
  }
  const { data, error } = await q;
  if (error || !data) return [];
  return data
    .filter((p) => typeof p.latitude === "number" && typeof p.longitude === "number")
    .map((p): SamplePin => {
      const v = (p as { videos: { youtube_video_id?: string; title?: string; thumbnail_url?: string; published_at?: string; youtube_channels?: { name?: string } | null } | null }).videos;
      const place = (p as { places: { city_name?: string; country_name?: string } | null }).places;
      const type = (ALLOWED_PIN_TYPES as string[]).includes(p.pin_type) ? (p.pin_type as PinType) : "new";
      return {
        id: p.id,
        lat: p.latitude as number,
        lng: p.longitude as number,
        type,
        title: v?.title ?? p.label ?? "Untitled",
        creator: v?.youtube_channels?.name ?? "Unknown",
        thumbnail: v?.thumbnail_url ?? "",
        location: [place?.city_name, place?.country_name].filter(Boolean).join(", ") || (p.label ?? ""),
        views: "",
        uploaded: v?.published_at ? new Date(v.published_at).toLocaleDateString() : "",
        youtubeId: v?.youtube_video_id ?? "",
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
let currentPins: SamplePin[] = [];
const PIN_SOURCE_ID = "wanderpins-source";

function pinsToGeoJSON(pins: SamplePin[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: pins.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        color: PIN_TYPE_COLORS[p.type],
        pin: JSON.stringify(p),
      },
    })),
  };
}

function setPinData(map: mapboxgl.Map, pins: SamplePin[]) {
  currentPins = pins;
  const src = map.getSource(PIN_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
  if (src) src.setData(pinsToGeoJSON(pins));
}

function setupPinLayers(map: mapboxgl.Map) {
  if (map.getSource(PIN_SOURCE_ID)) return;

  map.addSource(PIN_SOURCE_ID, {
    type: "geojson",
    data: pinsToGeoJSON([]),
    cluster: true,
    clusterRadius: 30,
    clusterMaxZoom: 6,
  });

  // Cluster bubbles
  map.addLayer({
    id: "wp-clusters",
    type: "circle",
    source: PIN_SOURCE_ID,
    filter: ["has", "point_count"],
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
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
      "text-size": 13,
      "text-allow-overlap": true,
    },
    paint: { "text-color": "#ffffff" },
  });

  // Invisible larger hit target for easier tapping on mobile
  map.addLayer({
    id: "wp-pin-hit",
    type: "circle",
    source: PIN_SOURCE_ID,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": "#000",
      "circle-opacity": 0,
      "circle-radius": 18,
    },
  });

  // Visible single pins
  map.addLayer({
    id: "wp-pin",
    type: "circle",
    source: PIN_SOURCE_ID,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": 9,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2.5,
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

function renderPins(map: mapboxgl.Map, channelIds?: string[]) {
  const base = !channelIds ? [...samplePins] : [];
  // Only seed with base if there is no data yet — avoids clearing existing
  // ingested pins (causing a flicker) when the followed-channels query refetches.
  if (currentPins.length === 0) setPinData(map, base);
  fetchIngestedPins(channelIds)
    .then((pins) => setPinData(map, [...base, ...pins]))
    .catch((e) => console.warn("[map] failed to load ingested pins", e));
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
    style: "mapbox://styles/mapbox/dark-v11",
    center: [20, 30],
    zoom: 1.6,
    attributionControl: false,
  });
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

  map.on("load", () => {
    boostLabelLegibility(map);
    setupPinLayers(map);
  });

  sharedMap = map;
  return { div, map };
}

export function MapView({
  onPinClick,
  followedChannelIds,
}: {
  onPinClick: (pin: SamplePin) => void;
  followedChannelIds?: string[];
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

  useEffect(() => {
    if (!token || !hostRef.current) return;
    const { div, map } = ensureSharedMap(token);
    const host = hostRef.current;
    host.appendChild(div);
    requestAnimationFrame(() => map.resize());

    const render = () => {
      setupPinLayers(map);
      renderPins(map, followedChannelIds);
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

    return () => {
      if (div.parentElement === host) host.removeChild(div);
    };
  }, [token, followedChannelIds?.join(",")]);

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

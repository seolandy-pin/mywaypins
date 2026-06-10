import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import { samplePins, PIN_TYPE_COLORS, type SamplePin } from "@/lib/sample-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Key } from "lucide-react";

const TOKEN_KEY = "wanderpins:mapbox_token";

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
let sharedHandlerRef: { current: PinHandler } = { current: () => {} };

function ensureSharedMap(token: string) {
  if (sharedDiv && sharedMap) return { div: sharedDiv, map: sharedMap };
  mapboxgl.accessToken = token;

  const div = document.createElement("div");
  div.style.cssText = "width:100%;height:100%;";
  // Park it off-DOM until first host attaches.
  sharedDiv = div;

  // Map needs the container in the DOM during init for sizing; attach hidden first.
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
    samplePins.forEach((pin) => {
      const el = document.createElement("button");
      el.className = "wanderpin-marker";
      el.style.cssText = `
        width: 26px; height: 26px; border-radius: 50%;
        background: ${PIN_TYPE_COLORS[pin.type]};
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        cursor: pointer; transition: transform 0.2s;
      `;
      el.onmouseenter = () => (el.style.transform = "scale(1.3)");
      el.onmouseleave = () => (el.style.transform = "scale(1)");
      el.onclick = (e) => {
        e.stopPropagation();
        sharedHandlerRef.current(pin);
      };
      new mapboxgl.Marker({ element: el }).setLngLat([pin.lng, pin.lat]).addTo(map);
    });
  });
  sharedMap = map;
  return { div, map };
}

export function MapView({ onPinClick }: { onPinClick: (pin: SamplePin) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState<string>("");
  const [tokenInput, setTokenInput] = useState("");

  useEffect(() => {
    setToken(getStoredToken());
  }, []);

  // Keep handler ref current without re-initing map.
  useEffect(() => {
    sharedHandlerRef.current = onPinClick;
  }, [onPinClick]);

  useEffect(() => {
    if (!token || !hostRef.current) return;
    const { div, map } = ensureSharedMap(token);
    const host = hostRef.current;
    host.appendChild(div);
    // Resize after reparent so the canvas matches the new container.
    requestAnimationFrame(() => map.resize());

    return () => {
      // Detach but keep alive in memory for next mount.
      if (div.parentElement === host) host.removeChild(div);
    };
  }, [token]);

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

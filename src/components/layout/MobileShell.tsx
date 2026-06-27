import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Map, Search, Bookmark, User, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

const tabs = [
  { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { to: "/map", label: "Map", icon: Map, match: (p: string) => p.startsWith("/map") },
  { to: "/search", label: "Discover", icon: Search, match: (p: string) => p.startsWith("/search") },
  { to: "/profile/saved", label: "Saved", icon: Bookmark, match: (p: string) => p.startsWith("/profile/saved") || p.startsWith("/profile_/saved") },
  { to: "/profile", label: "Profile", icon: User, match: (p: string) => p === "/profile" || (p.startsWith("/profile") && !p.includes("/saved")) },
] as const;

const HIDE_NAV_ROUTES: string[] = [];

export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideNav = HIDE_NAV_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const queryClient = useQueryClient();
  const [spinning, setSpinning] = useState(false);

  async function handleRefresh() {
    if (spinning) return;
    setSpinning(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      setTimeout(() => setSpinning(false), 600);
    }
  }

  // Place Refresh between Saved (index 3) and Profile (index 4)
  const left = tabs.slice(0, 4);
  const right = tabs.slice(4);

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[520px] flex-col bg-background">
      <main className={`flex-1 ${hideNav ? "" : "pb-24"}`}>{children}</main>
      {!hideNav && (
        <nav className="glass fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[520px] border-t border-border/60 safe-bottom">
          <ul className="grid grid-cols-6 px-2 pt-2">
            {left.map((t) => {
              const Icon = t.icon;
              const active = t.match(pathname);
              return (
                <li key={t.to}>
                  <Link
                    to={t.to}
                    preload="intent"
                    className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-colors ${
                      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.8} />
                    <span>{t.label}</span>
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={handleRefresh}
                aria-label="Refresh"
                className="flex w-full cursor-pointer flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <RefreshCw
                  className={`size-[22px] ${spinning ? "animate-spin" : ""}`}
                  strokeWidth={1.8}
                />
                <span>Refresh</span>
              </button>
            </li>
            {right.map((t) => {
              const Icon = t.icon;
              const active = t.match(pathname);
              return (
                <li key={t.to}>
                  <Link
                    to={t.to}
                    preload="intent"
                    className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-colors ${
                      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.8} />
                    <span>{t.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Map, Search, Users, User } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/map", label: "Map", icon: Map },
  { to: "/search", label: "Search", icon: Search },
  { to: "/following", label: "Following", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
] as const;

// Routes that should hide the bottom tab bar (full-screen flows).
const HIDE_NAV_ROUTES = ["/auth"];

/**
 * MobileShell is now rendered ONCE at the root (see src/routes/__root.tsx)
 * and wraps <Outlet />. Tab routes return their content directly — keeping
 * the shell + bottom nav mounted across navigations eliminates the per-tab
 * remount flicker (Mapbox singleton + React Query cache do the rest).
 *
 * The `children` prop is the route Outlet. `hideNav` is derived from the
 * current pathname so a route can opt out (e.g. /auth).
 */
export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideNav = HIDE_NAV_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[520px] flex-col bg-background">
      <main className={`flex-1 ${hideNav ? "" : "pb-24"}`}>{children}</main>
      {!hideNav && (
        <nav className="glass fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[520px] border-t border-border/60 safe-bottom">
          <ul className="grid grid-cols-5 px-2 pt-2">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = t.to === "/" ? pathname === "/" : pathname.startsWith(t.to);
              return (
                <li key={t.to}>
                  <Link
                    to={t.to}
                    preload="intent"
                    className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-colors ${
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

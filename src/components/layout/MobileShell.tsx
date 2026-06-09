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

export function MobileShell({ children, hideNav = false }: { children: ReactNode; hideNav?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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

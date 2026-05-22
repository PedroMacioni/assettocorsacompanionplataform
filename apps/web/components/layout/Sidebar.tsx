"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, List, TrendingUp, Car, MapPin, Settings, LogOut, ArrowDownToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sessions", label: "Sessions", icon: List },
  { href: "/analytics", label: "Analytics", icon: TrendingUp },
  { href: "/garage", label: "Garage", icon: Car },
  { href: "/tracks", label: "Tracks", icon: MapPin },
] as const;

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className="w-8 h-8 rounded-full object-cover shrink-0 border border-border"
      />
    );
  }
  const parts = name.trim().split(/\s+/);
  const letters =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-primary/[0.12] border border-primary/25 flex items-center justify-center shrink-0">
      <span className="text-[11px] font-bold text-primary">{letters}</span>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setDisplayName(
          data.user.user_metadata?.display_name ??
            data.user.email?.split("@")[0] ??
            "Driver"
        );
        setEmail(data.user.email ?? "");
        setAvatarUrl(data.user.user_metadata?.avatar_url ?? null);
      }
    });
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] flex flex-col bg-background border-r border-border z-40">

      {/* Logo */}
      <div className="px-5 pt-7 pb-6">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-bold tracking-[0.2em] text-foreground uppercase">
            Apex
          </span>
          <span className="text-[10px] font-medium text-muted-foreground tracking-widest">v1.0</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 tracking-wide">Sim Racing</p>
      </div>

      <div className="mx-4 h-px bg-border" />

      {/* Main nav */}
      <nav className="flex-1 px-3 pt-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium",
                "transition-all duration-150 ease-out",
                active
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full",
                  "transition-all duration-200 ease-out",
                  active
                    ? "h-5 bg-primary opacity-100"
                    : "h-0 bg-primary opacity-0 group-hover:h-3 group-hover:opacity-40"
                )}
              />
              <Icon
                className={cn(
                  "h-[15px] w-[15px] shrink-0 transition-all duration-150",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span className="transition-colors duration-150">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4">
        <div className="mx-1 h-px bg-border mb-3" />

        {/* Download agent */}
        {(() => {
          const active = isActive("/download");
          return (
            <Link
              href="/download"
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium",
                "transition-all duration-150 ease-out",
                active
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-200",
                  active
                    ? "h-5 bg-primary opacity-100"
                    : "h-0 opacity-0 group-hover:h-3 group-hover:opacity-40 bg-primary"
                )}
              />
              <ArrowDownToLine
                className={cn(
                  "h-[15px] w-[15px] shrink-0 transition-colors duration-150",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              Agent
            </Link>
          );
        })()}

        {/* Settings */}
        {(() => {
          const active = isActive("/settings");
          return (
            <Link
              href="/settings"
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium",
                "transition-all duration-150 ease-out",
                active
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-200",
                  active
                    ? "h-5 bg-primary opacity-100"
                    : "h-0 opacity-0 group-hover:h-3 group-hover:opacity-40 bg-primary"
                )}
              />
              <Settings
                className={cn(
                  "h-[15px] w-[15px] shrink-0 transition-colors duration-150",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              Settings
            </Link>
          );
        })()}

        {/* User card + sign out */}
        <div className="mt-3 mx-1 p-2.5 rounded-md bg-muted border border-border">
          <div className="flex items-center gap-2.5">
            <Avatar name={displayName || "D"} avatarUrl={avatarUrl} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate leading-tight">
                {displayName}
              </p>
              <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                {email}
              </p>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive transition-colors duration-150"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

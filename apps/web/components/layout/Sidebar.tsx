"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, List, TrendingUp, Car, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sessions", label: "Sessions", icon: List },
  { href: "/analytics", label: "Analytics", icon: TrendingUp },
  { href: "/garage", label: "Garage", icon: Car },
] as const;

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const letters =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-[#e8612a20] border border-[#e8612a40] flex items-center justify-center shrink-0">
      <span className="text-[11px] font-bold text-[#e8612a]">{letters}</span>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");

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
    <aside className="fixed left-0 top-0 h-screen w-[220px] flex flex-col bg-[#0d0d0f] border-r border-[#2a2a2c] z-40">

      {/* Logo */}
      <div className="px-5 pt-7 pb-6">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-bold tracking-[0.2em] text-white uppercase">
            Apex
          </span>
          <span className="text-[10px] font-medium text-[#6b6b72] tracking-widest">v1.0</span>
        </div>
        <p className="text-[10px] text-[#6b6b72] mt-0.5 tracking-wide">Sim Racing</p>
      </div>

      <div className="mx-4 h-px bg-[#2a2a2c]" />

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
                  ? "text-white bg-[#1a1a1c]"
                  : "text-[#6b6b72] hover:text-white hover:bg-[#161618]"
              )}
            >
              {/* Active indicator bar */}
              <span
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full",
                  "transition-all duration-200 ease-out",
                  active
                    ? "h-5 bg-[#e8612a] opacity-100"
                    : "h-0 bg-[#e8612a] opacity-0 group-hover:h-3 group-hover:opacity-40"
                )}
              />

              <Icon
                className={cn(
                  "h-[15px] w-[15px] shrink-0 transition-all duration-150",
                  active
                    ? "text-[#e8612a]"
                    : "text-[#6b6b72] group-hover:text-white"
                )}
              />

              <span className="transition-colors duration-150">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4">
        <div className="mx-1 h-px bg-[#2a2a2c] mb-3" />

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
                  ? "text-white bg-[#1a1a1c]"
                  : "text-[#6b6b72] hover:text-white hover:bg-[#161618]"
              )}
            >
              <span
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-200",
                  active
                    ? "h-5 bg-[#e8612a] opacity-100"
                    : "h-0 opacity-0 group-hover:h-3 group-hover:opacity-40 bg-[#e8612a]"
                )}
              />
              <Settings
                className={cn(
                  "h-[15px] w-[15px] shrink-0 transition-colors duration-150",
                  active ? "text-[#e8612a]" : "text-[#6b6b72] group-hover:text-white"
                )}
              />
              Settings
            </Link>
          );
        })()}

        {/* User card + sign out */}
        <div className="mt-3 mx-1 p-2.5 rounded-md bg-[#161618] border border-[#2a2a2c]">
          <div className="flex items-center gap-2.5">
            <Initials name={displayName || "D"} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {displayName}
              </p>
              <p className="text-[10px] text-[#6b6b72] truncate leading-tight mt-0.5">
                {email}
              </p>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              className="shrink-0 p-1 rounded text-[#6b6b72] hover:text-[#ef4444] transition-colors duration-150"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

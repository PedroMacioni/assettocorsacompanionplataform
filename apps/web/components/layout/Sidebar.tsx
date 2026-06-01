"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  List,
  TrendingUp,
  Car,
  MapPin,
  ArrowDownToLine,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  User,
  Users,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useSidebar } from "./SidebarContext";
import { ProfileDropdown } from "./ProfileDropdown";

function NavTooltip({ label, show }: { label: string; show: boolean }) {
  if (!show) return null;
  return (
    <div className="absolute left-full ml-2 px-2 py-1 rounded bg-popover border border-border text-xs font-medium text-foreground whitespace-nowrap z-50 pointer-events-none shadow-md">
      {label}
    </div>
  );
}

export function Sidebar() {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebar();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const navItems = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/sessions", label: t("sessions"), icon: List },
    { href: "/analytics", label: t("analytics"), icon: TrendingUp },
    { href: "/garage", label: t("garage"), icon: Car },
    { href: "/tracks", label: t("tracks"), icon: MapPin },
    { href: "/friends", label: t("friends"), icon: Users },
  ] as const;

  const bottomItems = [
    { href: "/profile", label: t("profile"), icon: User },
    { href: "/settings", label: t("settings"), icon: Settings },
    { href: "/download", label: t("agent"), icon: ArrowDownToLine },
  ] as const;

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

  function isActive(href: string) {
    if (href === "/profile") return pathname === "/profile";
    if (href === "/friends") return pathname === "/friends" || pathname.startsWith("/profile/");
    return pathname === href || pathname.startsWith(href + "/");
  }

  const sidebarContent = (
    <aside
      className={cn(
        "relative flex flex-col h-full bg-background border-r border-border overflow-hidden",
        "transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-[220px]"
      )}
    >
      {/* Logo + toggle */}
      <div className={cn("flex items-center pt-5 pb-5", collapsed ? "flex-col gap-3 px-3" : "justify-between px-4")}>
        {collapsed ? (
          <>
            <span className="text-[15px] font-bold tracking-[0.2em] text-primary uppercase">A</span>
            <button
              onClick={toggle}
              className="hidden md:flex w-7 h-7 rounded-md items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
              aria-label="Expandir menu"
            >
              <PanelLeftOpen className="h-[15px] w-[15px]" />
            </button>
          </>
        ) : (
          <>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-[15px] font-bold tracking-[0.2em] text-foreground uppercase">Apex</span>
                <span className="text-[10px] font-medium text-muted-foreground tracking-widest">v1.0</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 tracking-wide">Sim Racing</p>
            </div>
            <button
              onClick={toggle}
              className="hidden md:flex w-7 h-7 rounded-md items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 shrink-0"
              aria-label="Retrair menu"
            >
              <PanelLeftClose className="h-[15px] w-[15px]" />
            </button>
          </>
        )}
      </div>

      <div className="mx-4 h-px bg-border" />

      {/* Main nav */}
      <nav className={cn("flex-1 pt-3 space-y-0.5", collapsed ? "px-2" : "px-3")}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onMouseEnter={() => collapsed && setHoveredItem(href)}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group relative flex items-center rounded-md text-sm font-medium",
                "transition-all duration-150 ease-out",
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                active
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {!collapsed && (
                <span
                  className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full",
                    "transition-all duration-200 ease-out",
                    active
                      ? "h-5 bg-primary opacity-100"
                      : "h-0 bg-primary opacity-0 group-hover:h-3 group-hover:opacity-40"
                  )}
                />
              )}
              <Icon
                className={cn(
                  "h-[15px] w-[15px] shrink-0 transition-all duration-150",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {!collapsed && (
                <span className="transition-colors duration-150">{label}</span>
              )}
              {collapsed && hoveredItem === href && (
                <NavTooltip label={label} show />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className={cn("pb-4", collapsed ? "px-2" : "px-3")}>
        <div className="mx-1 h-px bg-border mb-3" />

        {bottomItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onMouseEnter={() => collapsed && setHoveredItem(href)}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group relative flex items-center rounded-md text-sm font-medium",
                "transition-all duration-150 ease-out",
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                active
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {!collapsed && (
                <span
                  className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-200",
                    active
                      ? "h-5 bg-primary opacity-100"
                      : "h-0 opacity-0 group-hover:h-3 group-hover:opacity-40 bg-primary"
                  )}
                />
              )}
              <Icon
                className={cn(
                  "h-[15px] w-[15px] shrink-0 transition-colors duration-150",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {!collapsed && <span>{label}</span>}
              {collapsed && hoveredItem === href && (
                <NavTooltip label={label} show />
              )}
            </Link>
          );
        })}

        {/* User card */}
        <div className="mt-3">
          <ProfileDropdown
            displayName={displayName}
            email={email}
            avatarUrl={avatarUrl}
            collapsed={collapsed}
          />
        </div>
      </div>

    </aside>
  );

  return (
    <>
      {/* Desktop: sidebar fixa */}
      <div className="hidden md:block fixed left-0 top-0 h-screen z-40">
        {sidebarContent}
      </div>

      {/* Mobile: overlay drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed left-0 top-0 h-screen z-50 md:hidden w-[220px]">
            <div className="relative h-full">
              {/* Força expanded no mobile drawer */}
              <aside className="flex flex-col h-full w-[220px] bg-background border-r border-border overflow-hidden">
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

                <nav className="flex-1 px-3 pt-3 space-y-0.5">
                  {navItems.map(({ href, label, icon: Icon }) => {
                    const active = isActive(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileOpen(false)}
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
                        <span>{label}</span>
                      </Link>
                    );
                  })}
                </nav>

                <div className="px-3 pb-4">
                  <div className="mx-1 h-px bg-border mb-3" />
                  {bottomItems.map(({ href, label, icon: Icon }) => {
                    const active = isActive(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileOpen(false)}
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
                        <Icon
                          className={cn(
                            "h-[15px] w-[15px] shrink-0 transition-colors duration-150",
                            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                          )}
                        />
                        <span>{label}</span>
                      </Link>
                    );
                  })}
                  <div className="mt-3 mx-1">
                    <ProfileDropdown
                      displayName={displayName}
                      email={email}
                      avatarUrl={avatarUrl}
                      collapsed={false}
                    />
                  </div>
                </div>
              </aside>

              {/* Botão fechar drawer */}
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Fechar menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

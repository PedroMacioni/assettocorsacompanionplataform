"use client";

import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";

export function SidebarAwareMain({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={cn(
        "flex-1 min-h-screen transition-all duration-300 ease-in-out",
        // Mobile: sem margem (sidebar é overlay)
        "ml-0",
        // Desktop: margem dinâmica conforme estado da sidebar
        collapsed ? "md:ml-16" : "md:ml-[220px]"
      )}
    >
      {children}
    </div>
  );
}

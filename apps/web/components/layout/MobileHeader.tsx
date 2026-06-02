"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "./SidebarContext";

export function MobileHeader() {
  const { setMobileOpen } = useSidebar();

  return (
    <div className="sticky top-0 z-30 flex items-center md:hidden border-b border-border bg-shell px-4 py-3">
      <button
        onClick={() => setMobileOpen(true)}
        className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-control-hover transition-colors"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>
    </div>
  );
}

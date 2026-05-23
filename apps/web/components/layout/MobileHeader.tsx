"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "./SidebarContext";

export function MobileHeader() {
  const { setMobileOpen } = useSidebar();

  return (
    <div className="flex items-center md:hidden px-4 pt-4 pb-2">
      <button
        onClick={() => setMobileOpen(true)}
        className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>
    </div>
  );
}

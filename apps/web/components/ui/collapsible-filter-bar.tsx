"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalStorage } from "@/lib/use-local-storage";
import { cn } from "@/lib/utils";

type CollapsibleFilterBarProps = {
  title: string;
  activeCount: number;
  activeLabel?: string;
  clearLabel: string;
  expandLabel?: string;
  collapseLabel?: string;
  storageKey: string;
  defaultCollapsed?: boolean;
  canClear?: boolean;
  onClear?: () => void;
  children: ReactNode;
  className?: string;
};

export function CollapsibleFilterBar({
  title,
  activeCount,
  activeLabel,
  clearLabel,
  expandLabel = "Expand",
  collapseLabel = "Collapse",
  storageKey,
  defaultCollapsed = true,
  canClear = false,
  onClear,
  children,
  className,
}: CollapsibleFilterBarProps) {
  const [collapsed, setCollapsed] = useLocalStorage(storageKey, defaultCollapsed);

  const displayTitle = activeCount > 0 && activeLabel
    ? activeLabel.replace("{count}", String(activeCount))
    : title;

  return (
    <section className={cn("rounded-lg border border-border bg-card", className)}>
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between p-3 md:p-4"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold text-foreground">
            {displayTitle}
          </span>
          {activeCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {activeCount}
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {collapsed ? expandLabel : collapseLabel}
          {collapsed ? (
            <ChevronDown className="size-4" aria-hidden="true" />
          ) : (
            <ChevronUp className="size-4" aria-hidden="true" />
          )}
        </span>
      </button>

      {!collapsed && (
        <div className="border-t border-border p-3 md:p-4">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {children}
          </div>
          {onClear && (
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClear}
                disabled={!canClear}
              >
                <X className="size-3.5" aria-hidden="true" />
                {clearLabel}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

type FilterControlProps = {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function FilterControl({ label, icon, children, className }: FilterControlProps) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

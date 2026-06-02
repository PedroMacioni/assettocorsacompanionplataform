"use client";

import type { ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FilterBarProps = {
  title: string;
  activeLabel?: string;
  clearLabel: string;
  canClear?: boolean;
  onClear?: () => void;
  children: ReactNode;
  className?: string;
};

type FilterControlProps = {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function FilterBar({
  title,
  activeLabel,
  clearLabel,
  canClear = false,
  onClear,
  children,
  className,
}: FilterBarProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-surface p-3 md:p-4",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          </span>
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
          {activeLabel && (
            <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              {activeLabel}
            </span>
          )}
        </div>
        {onClear && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={!canClear}
            className="shrink-0"
          >
            <X className="size-3.5" aria-hidden="true" />
            {clearLabel}
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">{children}</div>
    </section>
  );
}

export function FilterControl({ label, icon, children, className }: FilterControlProps) {
  return (
    <label className={cn("flex min-h-[64px] flex-col gap-1.5", className)}>
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

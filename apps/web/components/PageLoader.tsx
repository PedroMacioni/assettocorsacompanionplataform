"use client";

import { Gauge } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface PageLoaderProps {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  overlay?: boolean;
}

const outerSize = {
  sm: "size-12",
  md: "size-16",
  lg: "size-20",
};

export function PageLoader({ label, className, size = "md", overlay = false }: PageLoaderProps) {
  const t = useTranslations("Common");
  const resolvedLabel = label ?? t("loading");

  return (
    <div
      role="status"
      aria-label={resolvedLabel}
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        overlay
          ? "fixed inset-0 z-50 bg-background/85 backdrop-blur-sm"
          : "min-h-[320px]",
        className
      )}
    >
      <div className="relative">
        <div className="absolute -inset-4 rounded-full bg-primary/10 blur-2xl animate-pulse" />
        <div
          className={cn(
            "relative rounded-full border border-border bg-card shadow-2xl shadow-black/20",
            outerSize[size]
          )}
        >
          <div className="absolute inset-0 rounded-full border-2 border-primary/15 border-t-primary animate-spin" />
          <div
            className="absolute inset-2 rounded-full border border-muted-foreground/15 border-b-muted-foreground/60"
            style={{ animation: "spin 1.8s linear infinite reverse" }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Gauge className="size-4" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
      <p className="text-sm font-medium text-muted-foreground animate-pulse">
        {resolvedLabel}
      </p>
    </div>
  );
}

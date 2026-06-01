# Sessions Page Refactor - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the sessions page with simplified grid, collapsible filters, delta vs PB, badges, and share functionality.

**Architecture:** Server component fetches sessions with PB data, passes enriched data to client. Reusable UI components (CollapsibleFilterBar, ActionMenu, ShareModal) in `components/ui/`. Session-specific components in `app/(dashboard)/sessions/`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, next-intl, html-to-image

---

## File Structure

### New Files to Create

```
apps/web/
├── components/ui/
│   ├── collapsible-filter-bar.tsx    # Reusable collapsible filter container
│   ├── action-menu.tsx               # Reusable 3-dot menu dropdown
│   └── share-modal.tsx               # Reusable share modal with actions
├── app/(dashboard)/sessions/
│   ├── session-badge.tsx             # New PB / Consistent badges
│   ├── session-share-card.tsx        # Visual card for sharing
│   └── share-session-modal.tsx       # Session-specific share modal
└── lib/
    └── use-local-storage.ts          # Hook for localStorage state
```

### Files to Modify

```
apps/web/
├── app/(dashboard)/sessions/
│   ├── page.tsx                      # Add PB fetching, badge calculation
│   ├── SessionsContent.tsx           # New layout with collapsible filters
│   ├── SessionsClient.tsx            # New grid columns, action menu
│   └── SessionsFilters.tsx           # Simplified filters (remove Type, Date)
├── lib/
│   ├── types.ts                      # Add SessionWithMeta type
│   └── format.ts                     # Add formatDelta function
└── messages/
    ├── en.json                       # New translation keys
    └── pt-BR.json                    # New translation keys
```

---

## Task 1: Add formatDelta utility function

**Files:**
- Modify: `apps/web/lib/format.ts`

- [ ] **Step 1: Add formatDelta function**

```typescript
// Add to apps/web/lib/format.ts

export function formatDelta(deltaMs: number | null | undefined): string {
  if (deltaMs === null || deltaMs === undefined) return "—";
  const sign = deltaMs <= 0 ? "" : "+";
  const seconds = Math.abs(deltaMs) / 1000;
  return `${sign}${seconds.toFixed(3)}s`;
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/format.ts
git commit -m "feat: add formatDelta utility function"
```

---

## Task 2: Add SessionWithMeta type

**Files:**
- Modify: `apps/web/lib/types.ts`

- [ ] **Step 1: Add SessionWithMeta type**

```typescript
// Add to apps/web/lib/types.ts

export type SessionBadge = "new_pb" | "consistent" | null;

export type SessionWithMeta = Session & {
  deltaPbMs: number | null;
  badge: SessionBadge;
};
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/types.ts
git commit -m "feat: add SessionWithMeta type with delta and badge"
```

---

## Task 3: Create useLocalStorage hook

**Files:**
- Create: `apps/web/lib/use-local-storage.ts`

- [ ] **Step 1: Create the hook file**

```typescript
// apps/web/lib/use-local-storage.ts
"use client";

import { useState, useEffect, useCallback } from "react";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue = value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(nextValue));
        } catch (error) {
          console.warn(`Error setting localStorage key "${key}":`, error);
        }
        return nextValue;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/use-local-storage.ts
git commit -m "feat: add useLocalStorage hook"
```

---

## Task 4: Create CollapsibleFilterBar component

**Files:**
- Create: `apps/web/components/ui/collapsible-filter-bar.tsx`

- [ ] **Step 1: Create the component**

```typescript
// apps/web/components/ui/collapsible-filter-bar.tsx
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
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/ui/collapsible-filter-bar.tsx
git commit -m "feat: add CollapsibleFilterBar component"
```

---

## Task 5: Create ActionMenu component

**Files:**
- Create: `apps/web/components/ui/action-menu.tsx`

- [ ] **Step 1: Create the component**

```typescript
// apps/web/components/ui/action-menu.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActionMenuItem = {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
};

type ActionMenuProps = {
  items: ActionMenuItem[];
  className?: string;
};

export function ActionMenu({ items, className }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={menuRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Actions"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreVertical className="size-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onClick();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
                item.variant === "destructive"
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-foreground hover:bg-muted"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/ui/action-menu.tsx
git commit -m "feat: add ActionMenu component"
```

---

## Task 6: Create SessionBadge component

**Files:**
- Create: `apps/web/app/(dashboard)/sessions/session-badge.tsx`

- [ ] **Step 1: Create the component**

```typescript
// apps/web/app/(dashboard)/sessions/session-badge.tsx
"use client";

import { Trophy, BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SessionBadge as SessionBadgeType } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  badge: SessionBadgeType;
  className?: string;
};

export function SessionBadge({ badge, className }: Props) {
  const t = useTranslations("Sessions.badges");

  if (!badge) return null;

  const config = {
    new_pb: {
      label: t("newPb"),
      icon: Trophy,
      className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    },
    consistent: {
      label: t("consistent"),
      icon: BarChart3,
      className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    },
  };

  const { label, icon: Icon, className: badgeClassName } = config[badge];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        badgeClassName,
        className
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(dashboard)/sessions/session-badge.tsx
git commit -m "feat: add SessionBadge component"
```

---

## Task 7: Create ShareModal component

**Files:**
- Create: `apps/web/components/ui/share-modal.tsx`

- [ ] **Step 1: Create the component**

```typescript
// apps/web/components/ui/share-modal.tsx
"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { X, Link2, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ShareModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  shareUrl: string;
  copyLinkLabel: string;
  saveImageLabel: string;
  linkCopiedLabel: string;
  imageSavedLabel: string;
  cardRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
};

export function ShareModal({
  open,
  onClose,
  title,
  shareUrl,
  copyLinkLabel,
  saveImageLabel,
  linkCopiedLabel,
  imageSavedLabel,
  cardRef,
  children,
}: ShareModalProps) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [imageSaved, setImageSaved] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
      };
    }
  }, [open, onClose]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  }, [shareUrl]);

  const handleSaveImage = useCallback(async () => {
    if (!cardRef.current) return;

    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: "#0a0a0a",
      });

      const link = document.createElement("a");
      link.download = "session-card.png";
      link.href = dataUrl;
      link.click();

      setImageSaved(true);
      setTimeout(() => setImageSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save image:", error);
    }
  }, [cardRef]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 id="share-modal-title" className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="p-4">
            <div className="mb-4 flex justify-center">{children}</div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleCopyLink}
              >
                {linkCopied ? (
                  <>
                    <Check className="size-4" data-icon="inline-start" />
                    {linkCopiedLabel}
                  </>
                ) : (
                  <>
                    <Link2 className="size-4" data-icon="inline-start" />
                    {copyLinkLabel}
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleSaveImage}
              >
                {imageSaved ? (
                  <>
                    <Check className="size-4" data-icon="inline-start" />
                    {imageSavedLabel}
                  </>
                ) : (
                  <>
                    <Download className="size-4" data-icon="inline-start" />
                    {saveImageLabel}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Install html-to-image dependency**

Run: `cd apps/web && npm install html-to-image`
Expected: Package installed successfully

- [ ] **Step 3: Verify no syntax errors**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ui/share-modal.tsx apps/web/package.json apps/web/package-lock.json
git commit -m "feat: add ShareModal component with html-to-image"
```

---

## Task 8: Create SessionShareCard component

**Files:**
- Create: `apps/web/app/(dashboard)/sessions/session-share-card.tsx`

- [ ] **Step 1: Create the component**

```typescript
// apps/web/app/(dashboard)/sessions/session-share-card.tsx
"use client";

import { forwardRef } from "react";
import { Trophy } from "lucide-react";
import { formatLapTime, formatDelta, slugToName } from "@/lib/format";
import type { SessionBadge } from "@/lib/types";

type Props = {
  carId: string;
  trackId: string;
  bestLapMs: number | null;
  deltaPbMs: number | null;
  date: string;
  badge: SessionBadge;
};

export const SessionShareCard = forwardRef<HTMLDivElement, Props>(
  function SessionShareCard({ carId, trackId, bestLapMs, deltaPbMs, date, badge }, ref) {
    const formattedDate = new Date(date).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return (
      <div
        ref={ref}
        className="w-[400px] rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 text-white"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        {badge === "new_pb" && (
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="size-5 text-amber-400" />
            <span className="text-sm font-bold uppercase tracking-wider text-amber-400">
              New Personal Best
            </span>
          </div>
        )}

        <h3 className="text-2xl font-bold text-white">{slugToName(carId)}</h3>
        <p className="mt-1 text-base text-zinc-400">{slugToName(trackId)}</p>

        <div className="mt-6 flex items-baseline gap-4">
          <span className="font-mono text-4xl font-bold tabular-nums text-white">
            {formatLapTime(bestLapMs)}
          </span>
          {deltaPbMs !== null && deltaPbMs !== 0 && (
            <span
              className={`font-mono text-xl font-semibold tabular-nums ${
                deltaPbMs < 0 ? "text-emerald-400" : "text-orange-400"
              }`}
            >
              {formatDelta(deltaPbMs)}
            </span>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4">
          <span className="text-sm text-zinc-500">{formattedDate}</span>
          <span className="text-sm font-medium text-zinc-400">apexcompanion.com</span>
        </div>
      </div>
    );
  }
);
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(dashboard)/sessions/session-share-card.tsx
git commit -m "feat: add SessionShareCard component for sharing"
```

---

## Task 9: Create ShareSessionModal component

**Files:**
- Create: `apps/web/app/(dashboard)/sessions/share-session-modal.tsx`

- [ ] **Step 1: Create the component**

```typescript
// apps/web/app/(dashboard)/sessions/share-session-modal.tsx
"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { ShareModal } from "@/components/ui/share-modal";
import { SessionShareCard } from "./session-share-card";
import type { SessionWithMeta } from "@/lib/types";

type Props = {
  session: SessionWithMeta | null;
  open: boolean;
  onClose: () => void;
};

export function ShareSessionModal({ session, open, onClose }: Props) {
  const t = useTranslations("Sessions.share");
  const cardRef = useRef<HTMLDivElement>(null);

  if (!session) return null;

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/session/${session.source_id}`;

  return (
    <ShareModal
      open={open}
      onClose={onClose}
      title={t("title")}
      shareUrl={shareUrl}
      copyLinkLabel={t("copyLink")}
      saveImageLabel={t("saveImage")}
      linkCopiedLabel={t("linkCopied")}
      imageSavedLabel={t("imageSaved")}
      cardRef={cardRef}
    >
      <SessionShareCard
        ref={cardRef}
        carId={session.car_id}
        trackId={session.track_id}
        bestLapMs={session.best_lap_ms}
        deltaPbMs={session.deltaPbMs}
        date={session.started_at}
        badge={session.badge}
      />
    </ShareModal>
  );
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(dashboard)/sessions/share-session-modal.tsx
git commit -m "feat: add ShareSessionModal component"
```

---

## Task 10: Update translation files

**Files:**
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/pt-BR.json`

- [ ] **Step 1: Update en.json with new keys**

Replace the entire `Sessions` block in `apps/web/messages/en.json`:

```json
"Sessions": {
  "title": "Sessions",
  "filters": {
    "title": "Filters",
    "activeCount": "Filters ({count})",
    "expand": "Expand",
    "collapse": "Collapse",
    "clear": "Clear filters",
    "period": "Period",
    "car": "Car",
    "track": "Track",
    "onlyPb": "Only PB",
    "allCars": "All cars",
    "allTracks": "All tracks",
    "allPeriods": "All time",
    "thisWeek": "This week",
    "last30Days": "Last 30 days",
    "last90Days": "Last 90 days",
    "thisYear": "This year"
  },
  "grid": {
    "date": "Date",
    "car": "Car",
    "track": "Track",
    "bestLap": "Best Lap",
    "delta": "Delta",
    "noResults": "No sessions found"
  },
  "badges": {
    "newPb": "New PB",
    "consistent": "Consistent"
  },
  "actions": {
    "viewDetails": "View details",
    "share": "Share"
  },
  "share": {
    "title": "Share Session",
    "copyLink": "Copy link",
    "saveImage": "Save image",
    "linkCopied": "Link copied!",
    "imageSaved": "Image saved!"
  },
  "noSessions": "No sessions synced"
}
```

- [ ] **Step 2: Update pt-BR.json with new keys**

Replace the entire `Sessions` block in `apps/web/messages/pt-BR.json`:

```json
"Sessions": {
  "title": "Sessões",
  "filters": {
    "title": "Filtros",
    "activeCount": "Filtros ({count})",
    "expand": "Expandir",
    "collapse": "Recolher",
    "clear": "Limpar filtros",
    "period": "Período",
    "car": "Carro",
    "track": "Pista",
    "onlyPb": "Apenas PB",
    "allCars": "Todos os carros",
    "allTracks": "Todas as pistas",
    "allPeriods": "Todo o período",
    "thisWeek": "Esta semana",
    "last30Days": "Últimos 30 dias",
    "last90Days": "Últimos 90 dias",
    "thisYear": "Este ano"
  },
  "grid": {
    "date": "Data",
    "car": "Carro",
    "track": "Pista",
    "bestLap": "Melhor Volta",
    "delta": "Delta",
    "noResults": "Nenhuma sessão encontrada"
  },
  "badges": {
    "newPb": "Novo PB",
    "consistent": "Consistente"
  },
  "actions": {
    "viewDetails": "Ver detalhes",
    "share": "Compartilhar"
  },
  "share": {
    "title": "Compartilhar Sessão",
    "copyLink": "Copiar link",
    "saveImage": "Salvar imagem",
    "linkCopied": "Link copiado!",
    "imageSaved": "Imagem salva!"
  },
  "noSessions": "Nenhuma sessão sincronizada"
}
```

- [ ] **Step 3: Verify JSON is valid**

Run: `cd apps/web && node -e "require('./messages/en.json'); require('./messages/pt-BR.json'); console.log('Valid JSON')"`
Expected: "Valid JSON"

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/en.json apps/web/messages/pt-BR.json
git commit -m "feat(i18n): add translations for sessions page refactor"
```

---

## Task 11: Update SessionsFilters component

**Files:**
- Modify: `apps/web/app/(dashboard)/sessions/SessionsFilters.tsx`

- [ ] **Step 1: Rewrite SessionsFilters with new filters**

Replace the entire content of `apps/web/app/(dashboard)/sessions/SessionsFilters.tsx`:

```typescript
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarRange, Car, Flag, Trophy } from "lucide-react";
import {
  CollapsibleFilterBar,
  FilterControl,
} from "@/components/ui/collapsible-filter-bar";

export type SessionFilterOption = {
  value: string;
  label: string;
};

type Props = {
  cars: SessionFilterOption[];
  tracks: SessionFilterOption[];
  selected: {
    car?: string;
    track?: string;
    period?: string;
    onlyPb?: boolean;
  };
  activeCount: number;
};

const inputClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30";

const checkboxClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30 flex items-center gap-2 cursor-pointer";

export function SessionsFilters({ cars, tracks, selected, activeCount }: Props) {
  const t = useTranslations("Sessions");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(nextParams: URLSearchParams) {
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete("page");
    navigate(next);
  }

  function toggleOnlyPb() {
    const next = new URLSearchParams(searchParams.toString());
    if (selected.onlyPb) {
      next.delete("onlyPb");
    } else {
      next.set("onlyPb", "1");
    }
    next.delete("page");
    navigate(next);
  }

  function clearFilters() {
    navigate(new URLSearchParams());
  }

  return (
    <CollapsibleFilterBar
      title={t("filters.title")}
      activeCount={activeCount}
      activeLabel={t("filters.activeCount")}
      clearLabel={t("filters.clear")}
      expandLabel={t("filters.expand")}
      collapseLabel={t("filters.collapse")}
      storageKey="sessions-filters-collapsed"
      defaultCollapsed={true}
      canClear={activeCount > 0}
      onClear={clearFilters}
    >
      <FilterControl
        label={t("filters.period")}
        icon={<CalendarRange className="size-3" aria-hidden="true" />}
      >
        <select
          value={selected.period ?? ""}
          onChange={(e) => updateFilter("filter", e.target.value)}
          className={inputClassName}
        >
          <option value="">{t("filters.allPeriods")}</option>
          <option value="this_week">{t("filters.thisWeek")}</option>
          <option value="last_30_days">{t("filters.last30Days")}</option>
          <option value="last_90_days">{t("filters.last90Days")}</option>
          <option value="this_year">{t("filters.thisYear")}</option>
        </select>
      </FilterControl>

      <FilterControl
        label={t("filters.car")}
        icon={<Car className="size-3" aria-hidden="true" />}
      >
        <select
          value={selected.car ?? ""}
          onChange={(e) => updateFilter("car", e.target.value)}
          className={inputClassName}
        >
          <option value="">{t("filters.allCars")}</option>
          {cars.map((car) => (
            <option key={car.value} value={car.value}>
              {car.label}
            </option>
          ))}
        </select>
      </FilterControl>

      <FilterControl
        label={t("filters.track")}
        icon={<Flag className="size-3" aria-hidden="true" />}
      >
        <select
          value={selected.track ?? ""}
          onChange={(e) => updateFilter("track", e.target.value)}
          className={inputClassName}
        >
          <option value="">{t("filters.allTracks")}</option>
          {tracks.map((track) => (
            <option key={track.value} value={track.value}>
              {track.label}
            </option>
          ))}
        </select>
      </FilterControl>

      <FilterControl
        label={t("filters.onlyPb")}
        icon={<Trophy className="size-3" aria-hidden="true" />}
      >
        <button
          type="button"
          onClick={toggleOnlyPb}
          className={checkboxClassName}
        >
          <input
            type="checkbox"
            checked={selected.onlyPb ?? false}
            readOnly
            className="size-4 rounded border-input accent-primary"
          />
          <span>{t("filters.onlyPb")}</span>
        </button>
      </FilterControl>
    </CollapsibleFilterBar>
  );
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(dashboard)/sessions/SessionsFilters.tsx
git commit -m "refactor: update SessionsFilters with collapsible bar and new filters"
```

---

## Task 12: Update SessionsClient component

**Files:**
- Modify: `apps/web/app/(dashboard)/sessions/SessionsClient.tsx`

- [ ] **Step 1: Rewrite SessionsClient with new grid**

Replace the entire content of `apps/web/app/(dashboard)/sessions/SessionsClient.tsx`:

```typescript
"use client";

import { useTranslations } from "next-intl";
import { Eye, Share2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { formatLapTime, formatDelta, formatDate, slugToName } from "@/lib/format";
import type { SessionWithMeta } from "@/lib/types";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { SessionBadge } from "./session-badge";
import { cn } from "@/lib/utils";

type SortDirection = "asc" | "desc" | null;

interface Props {
  sessions: SessionWithMeta[];
  loadingId: string | null;
  sortDirection: SortDirection;
  onSelect: (sourceId: string) => void;
  onShare: (session: SessionWithMeta) => void;
  onSortChange: (direction: SortDirection) => void;
}

export function SessionsClient({
  sessions,
  loadingId,
  sortDirection,
  onSelect,
  onShare,
  onSortChange,
}: Props) {
  const t = useTranslations("Sessions");

  function handleSortClick() {
    if (sortDirection === null) {
      onSortChange("asc");
    } else if (sortDirection === "asc") {
      onSortChange("desc");
    } else {
      onSortChange(null);
    }
  }

  function getActions(session: SessionWithMeta): ActionMenuItem[] {
    return [
      {
        label: t("actions.viewDetails"),
        icon: <Eye className="size-4" />,
        onClick: () => onSelect(session.source_id),
      },
      {
        label: t("actions.share"),
        icon: <Share2 className="size-4" />,
        onClick: () => onShare(session),
      },
    ];
  }

  const SortIcon = sortDirection === "asc" ? ArrowUp : sortDirection === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-card">
        <div className="apex-scroll overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("grid.date")}
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("grid.car")}
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("grid.track")}
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={handleSortClick}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t("grid.bestLap")}
                    <SortIcon className={cn("size-3", sortDirection && "text-primary")} />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("grid.delta")}
                </th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  &nbsp;
                </th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-sm text-muted-foreground">
                    {t("grid.noResults")}
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => onSelect(s.source_id)}
                    aria-busy={loadingId === s.source_id}
                    className="group cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/60"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(s.started_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground transition-colors group-hover:text-primary">
                      {slugToName(s.car_id)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {slugToName(s.track_id)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                      {formatLapTime(s.best_lap_ms)}
                    </td>
                    <td className={cn(
                      "px-4 py-3 text-right font-mono text-sm",
                      s.deltaPbMs === null && "text-muted-foreground/50",
                      s.deltaPbMs !== null && s.deltaPbMs < 0 && "text-emerald-500",
                      s.deltaPbMs !== null && s.deltaPbMs > 0 && "text-orange-500",
                      s.deltaPbMs !== null && s.deltaPbMs === 0 && "text-primary"
                    )}>
                      {formatDelta(s.deltaPbMs)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <SessionBadge badge={s.badge} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ActionMenu items={getActions(s)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden">
        {sessions.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-4 py-14 text-center text-sm text-muted-foreground">
            {t("grid.noResults")}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => onSelect(s.source_id)}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3.5 transition-colors cursor-pointer",
                  "hover:bg-muted/60 active:bg-muted",
                  loadingId === s.source_id && "opacity-60"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {slugToName(s.car_id)}
                    </p>
                    <SessionBadge badge={s.badge} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {slugToName(s.track_id)}
                  </p>
                  <p className="text-lg font-bold font-mono text-foreground mt-1">
                    {formatLapTime(s.best_lap_ms)}
                  </p>
                </div>
                <ActionMenu items={getActions(s)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(dashboard)/sessions/SessionsClient.tsx
git commit -m "refactor: update SessionsClient with new grid columns and actions"
```

---

## Task 13: Update SessionsContent component

**Files:**
- Modify: `apps/web/app/(dashboard)/sessions/SessionsContent.tsx`

- [ ] **Step 1: Rewrite SessionsContent with new layout**

Replace the entire content of `apps/web/app/(dashboard)/sessions/SessionsContent.tsx`:

```typescript
"use client";

import { useState, useCallback, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SessionDetailPanel, type SessionPanelData } from "@/components/SessionDetailPanel";
import { SessionsClient } from "./SessionsClient";
import { SessionsFilters, type SessionFilterOption } from "./SessionsFilters";
import { ShareSessionModal } from "./share-session-modal";
import { PageLoader } from "@/components/PageLoader";
import { PaginationClient } from "@/components/ui/pagination-client";
import type { SessionWithMeta } from "@/lib/types";

type SortDirection = "asc" | "desc" | null;

type SelectedFilters = {
  car?: string;
  track?: string;
  period?: string;
  onlyPb?: boolean;
};

interface Props {
  sessions: SessionWithMeta[];
  cars: SessionFilterOption[];
  tracks: SessionFilterOption[];
  selected: SelectedFilters;
  activeFilterCount: number;
  currentPage: number;
  totalPages: number;
  queryParams: Record<string, string | undefined>;
}

export function SessionsContent({
  sessions,
  cars,
  tracks,
  selected,
  activeFilterCount,
  currentPage,
  totalPages,
  queryParams,
}: Props) {
  const t = useTranslations("Sessions");
  const router = useRouter();
  const [panel, setPanel] = useState<SessionPanelData | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [shareSession, setShareSession] = useState<SessionWithMeta | null>(null);

  const sortedSessions = useMemo(() => {
    if (sortDirection === null) return sessions;

    return [...sessions].sort((a, b) => {
      const aTime = a.best_lap_ms ?? Infinity;
      const bTime = b.best_lap_ms ?? Infinity;
      return sortDirection === "asc" ? aTime - bTime : bTime - aTime;
    });
  }, [sessions, sortDirection]);

  const openSession = useCallback(async (sourceId: string) => {
    if (loadingId) return;
    setLoadingId(sourceId);
    try {
      const res = await fetch(`/api/sessions/${sourceId}`);
      if (res.ok) setPanel(await res.json());
    } finally {
      setLoadingId(null);
    }
  }, [loadingId]);

  const closePanel = useCallback(() => setPanel(null), []);

  function handlePageChange(page: number) {
    if (page === currentPage || isPending) return;

    const next = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) next.set(key, value);
    });
    next.set("page", String(page));

    startTransition(() => {
      router.push(`/sessions?${next.toString()}`);
    });
  }

  if (panel) {
    return <SessionDetailPanel data={panel} onClose={closePanel} />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {t("title")}
      </h1>

      <SessionsFilters
        cars={cars}
        tracks={tracks}
        selected={selected}
        activeCount={activeFilterCount}
      />

      {isPending ? (
        <div className="rounded-lg border border-border bg-card">
          <PageLoader size="md" className="min-h-[320px]" />
        </div>
      ) : (
        <SessionsClient
          sessions={sortedSessions}
          loadingId={loadingId}
          sortDirection={sortDirection}
          onSelect={openSession}
          onShare={setShareSession}
          onSortChange={setSortDirection}
        />
      )}

      <PaginationClient
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />

      <ShareSessionModal
        session={shareSession}
        open={shareSession !== null}
        onClose={() => setShareSession(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(dashboard)/sessions/SessionsContent.tsx
git commit -m "refactor: update SessionsContent with new layout and share modal"
```

---

## Task 14: Update sessions page.tsx

**Files:**
- Modify: `apps/web/app/(dashboard)/sessions/page.tsx`

- [ ] **Step 1: Rewrite page.tsx with PB fetching and badge calculation**

Replace the entire content of `apps/web/app/(dashboard)/sessions/page.tsx`:

```typescript
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { slugToName } from "@/lib/format";
import type { Session, PersonalBest, SessionWithMeta, SessionBadge } from "@/lib/types";
import { SessionsContent } from "./SessionsContent";
import { type SessionFilterOption } from "./SessionsFilters";

type SearchParams = {
  page?: string;
  car?: string;
  track?: string;
  filter?: string;
  onlyPb?: string;
};

type PeriodFilter = "this_week" | "last_30_days" | "last_90_days" | "this_year";

const PERIOD_FILTERS = new Set<string>(["this_week", "last_30_days", "last_90_days", "this_year"]);

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizePeriod(value?: string): PeriodFilter | undefined {
  return value && PERIOD_FILTERS.has(value) ? (value as PeriodFilter) : undefined;
}

function includeSelected(
  options: SessionFilterOption[],
  selected: string | undefined,
  labelFor: (value: string) => string
): SessionFilterOption[] {
  if (!selected || options.some((option) => option.value === selected)) return options;
  return [{ value: selected, label: labelFor(selected) }, ...options];
}

function calculateBadge(
  session: Session,
  pb: PersonalBest | null
): SessionBadge {
  if (!pb || !session.best_lap_ms) return null;

  // New PB: session's best lap equals the current PB
  if (session.best_lap_ms === pb.time_ms) {
    return "new_pb";
  }

  // For now, we can't calculate consistency without lap data
  // This would require a separate query or pre-calculated field
  return null;
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const t = await getTranslations("Sessions");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = 10;
  const from = (page - 1) * pageSize;
  const period = normalizePeriod(params.filter);
  const onlyPb = params.onlyPb === "1";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user!.id;

  let query = supabase
    .from("sessions")
    .select("*", { count: "exact" })
    .eq("user_id", uid)
    .neq("session_types", "--")
    .order("started_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (params.car) query = query.eq("car_id", params.car);
  if (params.track) query = query.eq("track_id", params.track);

  if (period === "this_week") {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    query = query.gte("started_at", weekStart.toISOString());
  } else if (period === "last_30_days") {
    const monthStart = new Date();
    monthStart.setDate(monthStart.getDate() - 30);
    monthStart.setHours(0, 0, 0, 0);
    query = query.gte("started_at", monthStart.toISOString());
  } else if (period === "last_90_days") {
    const start = new Date();
    start.setDate(start.getDate() - 90);
    start.setHours(0, 0, 0, 0);
    query = query.gte("started_at", start.toISOString());
  } else if (period === "this_year") {
    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);
    query = query.gte("started_at", yearStart.toISOString());
  }

  const [sessionsRes, totalRes, carsRes, tracksRes, pbsRes] = await Promise.all([
    query,
    supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid)
      .neq("session_types", "--"),
    supabase
      .from("top_cars")
      .select("car_id")
      .eq("user_id", uid)
      .order("sessions", { ascending: false }),
    supabase
      .from("top_tracks")
      .select("track_id")
      .eq("user_id", uid)
      .order("sessions", { ascending: false }),
    supabase
      .from("personal_bests")
      .select("*")
      .eq("user_id", uid),
  ]);

  const sessions = (sessionsRes.data ?? []) as Session[];
  const pbs = (pbsRes.data ?? []) as PersonalBest[];

  // Create a map for quick PB lookup
  const pbMap = new Map<string, PersonalBest>();
  for (const pb of pbs) {
    const key = `${pb.car_id}:${pb.track_id}`;
    pbMap.set(key, pb);
  }

  // Enrich sessions with delta and badge
  let enrichedSessions: SessionWithMeta[] = sessions.map((session) => {
    const key = `${session.car_id}:${session.track_id}`;
    const pb = pbMap.get(key) ?? null;
    const deltaPbMs = pb && session.best_lap_ms ? session.best_lap_ms - pb.time_ms : null;
    const badge = calculateBadge(session, pb);

    return {
      ...session,
      deltaPbMs,
      badge,
    };
  });

  // Filter only PB sessions if requested
  if (onlyPb) {
    enrichedSessions = enrichedSessions.filter((s) => s.badge === "new_pb");
  }

  const filteredCount = onlyPb ? enrichedSessions.length : (sessionsRes.count ?? 0);
  const totalCount = totalRes.count ?? filteredCount;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));

  const carOptions = includeSelected(
    ((carsRes.data ?? []) as { car_id: string }[])
      .filter((row) => Boolean(row.car_id))
      .map((row) => ({ value: row.car_id, label: slugToName(row.car_id) })),
    params.car,
    slugToName
  );

  const trackOptions = includeSelected(
    ((tracksRes.data ?? []) as { track_id: string }[])
      .filter((row) => Boolean(row.track_id))
      .map((row) => ({ value: row.track_id, label: slugToName(row.track_id) })),
    params.track,
    slugToName
  );

  const activeFilterCount = [
    params.car,
    params.track,
    period,
    onlyPb,
  ].filter(Boolean).length;

  if (enrichedSessions.length === 0 && page === 1 && activeFilterCount === 0) {
    return <EmptyState title={t("noSessions")} />;
  }

  return (
    <SessionsContent
      sessions={enrichedSessions}
      cars={carOptions}
      tracks={trackOptions}
      selected={{
        car: params.car,
        track: params.track,
        period,
        onlyPb,
      }}
      activeFilterCount={activeFilterCount}
      currentPage={page}
      totalPages={totalPages}
      queryParams={{
        car: params.car,
        track: params.track,
        filter: period,
        onlyPb: onlyPb ? "1" : undefined,
      }}
    />
  );
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(dashboard)/sessions/page.tsx
git commit -m "refactor: update sessions page with PB fetching and badge calculation"
```

---

## Task 15: Test the implementation

**Files:**
- None (testing only)

- [ ] **Step 1: Start the development server**

Run: `cd apps/web && npm run dev`
Expected: Server starts without errors

- [ ] **Step 2: Test the sessions page in browser**

Open: `http://localhost:3000/sessions`

Verify:
- [ ] Page loads with new header (just "Sessions" or "Sessões")
- [ ] Filters are collapsed by default
- [ ] Clicking "Filters" expands the filter bar
- [ ] Filter state persists after page refresh (F5)
- [ ] Grid shows: Date, Car, Track, Best Lap, Delta, Badge, Actions menu
- [ ] Clicking on Best Lap header sorts the table
- [ ] Action menu (⋮) shows "View details" and "Share"
- [ ] Clicking "View details" opens session detail panel
- [ ] Clicking "Share" opens share modal
- [ ] Share modal shows card preview
- [ ] "Copy link" copies URL to clipboard
- [ ] "Save image" downloads PNG
- [ ] Mobile view shows simplified cards

- [ ] **Step 3: Test filters**

Verify:
- [ ] Period filter works (This week, Last 30 days, Last 90 days, This year)
- [ ] Car filter works
- [ ] Track filter works
- [ ] "Only PB" toggle filters to only PB sessions
- [ ] "Clear filters" button resets all filters
- [ ] Filter count badge updates correctly

- [ ] **Step 4: Test i18n**

Change language in settings and verify:
- [ ] All labels are translated correctly

- [ ] **Step 5: Commit final state**

```bash
git add -A
git commit -m "test: verify sessions page refactor works correctly"
```

---

## Task 16: Final cleanup and verification

**Files:**
- Various (cleanup only)

- [ ] **Step 1: Run linter**

Run: `cd apps/web && npm run lint`
Expected: No errors (or fix any that appear)

- [ ] **Step 2: Run type check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `cd apps/web && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix lint and type errors"
```

- [ ] **Step 5: Final commit with summary**

```bash
git add -A
git commit -m "feat: complete sessions page refactor

- Simplified grid with Date, Car, Track, Best Lap, Delta, Badge columns
- Collapsible filter bar with localStorage persistence
- New filters: Period, Car, Track, Only PB
- Action menu with View details and Share options
- Share modal with card preview and image export
- Mobile-optimized card layout
- Full i18n support (en, pt-BR)
- Reusable components: CollapsibleFilterBar, ActionMenu, ShareModal

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

This plan creates:

**Reusable Components:**
- `CollapsibleFilterBar` — collapsible filter container with localStorage
- `ActionMenu` — dropdown menu with actions
- `ShareModal` — share modal with copy/download actions

**Session-Specific Components:**
- `SessionBadge` — New PB / Consistent badge display
- `SessionShareCard` — visual card for image export
- `ShareSessionModal` — session share modal wrapper

**Updated Files:**
- `page.tsx` — fetches PBs, calculates deltas and badges
- `SessionsContent.tsx` — new layout with share modal
- `SessionsClient.tsx` — new grid with sorting and action menu
- `SessionsFilters.tsx` — collapsible with new filters
- `format.ts` — formatDelta function
- `types.ts` — SessionWithMeta type
- `en.json` / `pt-BR.json` — new translations

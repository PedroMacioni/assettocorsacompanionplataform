"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ListChecks } from "lucide-react";
import { SessionDetailPanel, type SessionPanelData } from "@/components/SessionDetailPanel";
import { SessionsClient } from "./SessionsClient";
import { SessionsFilters, type SessionFilterOption } from "./SessionsFilters";
import { PageLoader } from "@/components/PageLoader";
import { PaginationClient } from "@/components/ui/pagination-client";
import type { Session } from "@/lib/types";

type SelectedFilters = {
  car?: string;
  track?: string;
  type?: string;
  period?: string;
  date?: string;
};

interface Props {
  sessions: Session[];
  cars: SessionFilterOption[];
  tracks: SessionFilterOption[];
  types: SessionFilterOption[];
  selected: SelectedFilters;
  activeFilterCount: number;
  filteredCount: number;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  queryParams: Record<string, string | undefined>;
}

export function SessionsContent({
  sessions,
  cars,
  tracks,
  types,
  selected,
  activeFilterCount,
  filteredCount,
  totalCount,
  currentPage,
  totalPages,
  queryParams,
}: Props) {
  const t = useTranslations("Sessions");
  const router = useRouter();
  const [panel, setPanel] = useState<SessionPanelData | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("history")}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        </div>

        <div className="flex w-fit items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ListChecks className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("results.label")}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {activeFilterCount > 0
                ? t("results.filteredCount", { count: filteredCount, total: totalCount })
                : t("results.count", { count: totalCount })}
            </p>
          </div>
        </div>
      </div>

      <SessionsFilters
        cars={cars}
        tracks={tracks}
        types={types}
        selected={selected}
        activeCount={activeFilterCount}
      />

      {isPending ? (
        <div className="rounded-lg border border-border bg-card">
          <PageLoader size="md" className="min-h-[320px]" />
        </div>
      ) : (
        <SessionsClient sessions={sessions} loadingId={loadingId} onSelect={openSession} />
      )}

      <PaginationClient
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}

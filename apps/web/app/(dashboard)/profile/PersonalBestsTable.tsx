"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { formatLapTime } from "@/lib/format";
import { PageLoader } from "@/components/PageLoader";
import { PaginationClient } from "@/components/ui/pagination-client";

export type EnrichedPB = {
  id: string;
  car_id: string;
  track_id: string;
  time_ms: number;
  source_date: number | null;
  synced_at: string;
  carName: string;
  trackName: string;
};

const PAGE_SIZE = 10;

export function PersonalBestsTable({ records }: { records: EnrichedPB[] }) {
  const t = useTranslations("Profile");
  const [page, setPage] = useState(1);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = records.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;
  const to = Math.min(from + PAGE_SIZE, total);
  const slice = records.slice(from, to);

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };
  }, []);

  function handlePageChange(nextPage: number) {
    if (nextPage === page || isPageLoading) return;

    setIsPageLoading(true);
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    loadingTimerRef.current = setTimeout(() => {
      setPage(nextPage);
      setIsPageLoading(false);
    }, 120);
  }

  function formatDate(synced_at: string): string {
    return new Date(synced_at).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  }

  if (total === 0) {
    return (
      <div className="bg-card border border-border rounded-md p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("records.empty")}</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-border">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("records.title")}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {t("records.showing", { from: from + 1, to, total })}
        </p>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[2rem_1fr_1fr_6rem] sm:grid-cols-[2rem_1fr_1fr_6rem_5rem] gap-3 px-5 py-2.5 bg-muted/30 border-b border-border">
        {[
          t("records.rank"),
          t("records.car"),
          t("records.track"),
          t("records.time"),
        ].map((h) => (
          <span
            key={h}
            className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
          >
            {h}
          </span>
        ))}
        <span className="hidden sm:block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("records.date")}
        </span>
      </div>

      {/* Rows */}
      {isPageLoading ? (
        <PageLoader size="sm" className="min-h-[260px]" />
      ) : (
        <div className="divide-y divide-border">
          {slice.map((pb, i) => {
            const rank = from + i + 1;
            const isTop = rank <= 3;
            return (
              <div
                key={pb.id}
                className="grid grid-cols-[2rem_1fr_1fr_6rem] sm:grid-cols-[2rem_1fr_1fr_6rem_5rem] gap-3 px-5 py-3 items-center hover:bg-muted/20 transition-colors"
              >
                <span
                  className={`text-xs font-bold tabular-nums ${
                    isTop ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {rank}
                </span>
                <span className="text-sm text-foreground truncate">{pb.carName}</span>
                <span className="text-sm text-muted-foreground truncate">{pb.trackName}</span>
                <span className={`text-sm font-bold font-mono ${isTop ? "text-primary" : "text-foreground"}`}>
                  {formatLapTime(pb.time_ms)}
                </span>
                <span className="hidden sm:block text-xs text-muted-foreground">
                  {formatDate(pb.synced_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 py-4 border-t border-border">
          <PaginationClient
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}

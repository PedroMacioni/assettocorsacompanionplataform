"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Eye, Share2, ArrowUpDown, ArrowUp, ArrowDown, Trophy } from "lucide-react";
import { formatLapTime, formatDelta, formatDate, slugToName } from "@/lib/format";
import type { SessionWithMeta } from "@/lib/types";
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

const actionBtnClass =
  "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

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
    if (sortDirection === null) onSortChange("asc");
    else if (sortDirection === "asc") onSortChange("desc");
    else onSortChange(null);
  }

  const SortIcon =
    sortDirection === "asc" ? ArrowUp : sortDirection === "desc" ? ArrowDown : ArrowUpDown;

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
                <th className="px-4 py-3 text-center">
                  <Trophy className="mx-auto size-3 text-muted-foreground" aria-label="Status" />
                </th>
                <th className="w-[88px] px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("grid.actions")}
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
                    aria-busy={loadingId === s.source_id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(s.started_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/garage?search=${encodeURIComponent(slugToName(s.car_id))}`}
                        className="font-medium text-foreground transition-colors hover:text-primary hover:underline underline-offset-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {slugToName(s.car_id)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/tracks?search=${encodeURIComponent(slugToName(s.track_id))}`}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline underline-offset-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {slugToName(s.track_id)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                      {formatLapTime(s.best_lap_ms)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-mono text-sm",
                        s.deltaPbMs === null && "text-muted-foreground/50",
                        s.deltaPbMs !== null && s.deltaPbMs < 0 && "text-emerald-500",
                        s.deltaPbMs !== null && s.deltaPbMs > 0 && "text-orange-500",
                        s.deltaPbMs !== null && s.deltaPbMs === 0 && "text-primary"
                      )}
                    >
                      {formatDelta(s.deltaPbMs)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <SessionBadge badge={s.badge} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          title={t("actions.viewDetails")}
                          disabled={loadingId === s.source_id}
                          onClick={() => onSelect(s.source_id)}
                          className={actionBtnClass}
                        >
                          <Eye className="size-4" />
                        </button>
                        <button
                          type="button"
                          title={t("actions.share")}
                          onClick={() => onShare(s)}
                          className={actionBtnClass}
                        >
                          <Share2 className="size-4" />
                        </button>
                      </div>
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
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3.5",
                  loadingId === s.source_id && "opacity-60"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Link
                      href={`/garage?search=${encodeURIComponent(slugToName(s.car_id))}`}
                      className="text-sm font-semibold text-foreground hover:text-primary hover:underline underline-offset-2 truncate"
                    >
                      {slugToName(s.car_id)}
                    </Link>
                    <SessionBadge badge={s.badge} />
                  </div>
                  <Link
                    href={`/tracks?search=${encodeURIComponent(slugToName(s.track_id))}`}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-2 truncate block"
                  >
                    {slugToName(s.track_id)}
                  </Link>
                  <p className="text-lg font-bold font-mono text-foreground mt-1">
                    {formatLapTime(s.best_lap_ms)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title={t("actions.viewDetails")}
                    disabled={loadingId === s.source_id}
                    onClick={() => onSelect(s.source_id)}
                    className={actionBtnClass}
                  >
                    <Eye className="size-4" />
                  </button>
                  <button
                    type="button"
                    title={t("actions.share")}
                    onClick={() => onShare(s)}
                    className={actionBtnClass}
                  >
                    <Share2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

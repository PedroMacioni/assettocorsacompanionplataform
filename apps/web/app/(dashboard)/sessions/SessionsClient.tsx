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

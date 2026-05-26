"use client";

import { useTranslations } from "next-intl";
import { formatLapTime, formatDistance, formatDate, slugToName } from "@/lib/format";
import type { Session } from "@/lib/types";
import { cn } from "@/lib/utils";

const SESSION_BADGE: Record<string, string> = {
  Hotlap: "bg-primary/[0.12] text-primary border border-primary/[0.18]",
  Race: "bg-green-500/[0.12] text-green-500 border border-green-500/[0.18]",
  Practice: "bg-muted-foreground/[0.12] text-muted-foreground border border-muted-foreground/[0.18]",
  "Time Attack": "bg-blue-500/[0.12] text-blue-500 border border-blue-500/[0.18]",
};

function SessionBadge({ type }: { type: string | null }) {
  if (!type || type === "--") return <span className="text-muted-foreground/40">--</span>;

  const cls =
    SESSION_BADGE[type] ??
    "bg-muted-foreground/[0.12] text-muted-foreground border border-muted-foreground/[0.18]";

  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {type}
    </span>
  );
}

interface Props {
  sessions: Session[];
  loadingId: string | null;
  onSelect: (sourceId: string) => void;
}

export function SessionsClient({ sessions, loadingId, onSelect }: Props) {
  const t = useTranslations("Sessions");

  return (
    <>
      {/* ── Desktop: tabela ────────────────────────────────────────────── */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-card">
        <div className="apex-scroll overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border">
                {[
                  { label: t("table.date"),     right: false },
                  { label: t("table.car"),      right: false },
                  { label: t("table.track"),    right: false },
                  { label: t("table.type"),     right: false },
                  { label: t("table.laps"),     right: true  },
                  { label: t("table.distance"), right: true  },
                  { label: t("table.bestLap"),  right: true  },
                ].map(({ label, right }) => (
                  <th
                    key={label}
                    className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${right ? "text-right" : "text-left"}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-sm text-muted-foreground">
                    {t("noResults")}
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
                    <td className="px-4 py-3 text-sm text-muted-foreground">{slugToName(s.track_id)}</td>
                    <td className="px-4 py-3"><SessionBadge type={s.session_types} /></td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{s.laps}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatDistance(s.distance_km)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                      {formatLapTime(s.best_lap_ms)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile: lista de cards ─────────────────────────────────────── */}
      <div className="md:hidden">
        {sessions.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-4 py-14 text-center text-sm text-muted-foreground">
            {t("noResults")}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.source_id)}
                disabled={!!loadingId}
                className={cn(
                  "w-full text-left px-4 py-3.5 transition-colors",
                  "hover:bg-muted/60 active:bg-muted",
                  loadingId === s.source_id && "opacity-60"
                )}
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {slugToName(s.car_id)}
                  </p>
                  <p className="text-sm font-bold font-mono text-foreground shrink-0">
                    {formatLapTime(s.best_lap_ms)}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-xs text-muted-foreground truncate">
                    {slugToName(s.track_id)}
                  </p>
                  <p className="text-[10px] text-muted-foreground shrink-0">
                    {formatDate(s.started_at)}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <SessionBadge type={s.session_types} />
                  <span className="text-[10px] text-muted-foreground">
                    {s.laps} {t("table.laps").toLowerCase()}
                  </span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistance(s.distance_km)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

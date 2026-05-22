"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { formatLapTime, formatDistance, formatDate, slugToName } from "@/lib/format";
import type { Session } from "@/lib/types";
import { SessionDetailPanel, type SessionPanelData } from "@/components/SessionDetailPanel";
import { PageLoader } from "@/components/PageLoader";

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

export function SessionsClient({ sessions }: { sessions: Session[] }) {
  const t = useTranslations("Sessions");
  const [panel, setPanel] = useState<SessionPanelData | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

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

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="apex-scroll overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border">
                {[
                  { label: t("table.date"), right: false },
                  { label: t("table.car"), right: false },
                  { label: t("table.track"), right: false },
                  { label: t("table.type"), right: false },
                  { label: t("table.laps"), right: true },
                  { label: t("table.distance"), right: true },
                  { label: t("table.bestLap"), right: true },
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
                  <td
                    colSpan={7}
                    className="px-4 py-14 text-center text-sm text-muted-foreground"
                  >
                    {t("noResults")}
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => openSession(s.source_id)}
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

      {loadingId && <PageLoader overlay size="md" label={t("loadingSession")} />}
      <SessionDetailPanel data={panel} onClose={closePanel} />
    </>
  );
}

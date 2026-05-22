"use client";

import { useState, useCallback } from "react";
import { formatLapTime, formatDistance, formatDate, slugToName } from "@/lib/format";
import type { Session } from "@/lib/types";
import { SessionDetailPanel, type SessionPanelData } from "@/components/SessionDetailPanel";

const SESSION_BADGE: Record<string, string> = {
  Hotlap:        "bg-primary/[0.12] text-primary border border-primary/[0.18]",
  Race:          "bg-green-500/[0.12] text-green-500 border border-green-500/[0.18]",
  Practice:      "bg-muted-foreground/[0.12] text-muted-foreground border border-muted-foreground/[0.18]",
  "Time Attack": "bg-blue-500/[0.12] text-blue-500 border border-blue-500/[0.18]",
};

function SessionBadge({ type }: { type: string | null }) {
  if (!type || type === "--") return <span className="text-muted-foreground/40">—</span>;
  const cls = SESSION_BADGE[type] ?? "bg-muted-foreground/[0.12] text-muted-foreground border border-muted-foreground/[0.18]";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {type}
    </span>
  );
}

export function SessionsClient({ sessions }: { sessions: Session[] }) {
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
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {[
                { label: "Data",        right: false },
                { label: "Carro",       right: false },
                { label: "Pista",       right: false },
                { label: "Tipo",        right: false },
                { label: "Voltas",      right: true  },
                { label: "Distância",   right: true  },
                { label: "Melhor Volta",right: true  },
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
            {sessions.map((s) => {
              const isLoading = loadingId === s.source_id;
              return (
                <tr
                  key={s.id}
                  onClick={() => openSession(s.source_id)}
                  className="border-b border-border last:border-0 hover:bg-muted/60 transition-colors cursor-pointer group"
                >
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                    {formatDate(s.started_at)}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground group-hover:text-primary transition-colors">
                    {isLoading ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        {slugToName(s.car_id)}
                      </span>
                    ) : slugToName(s.car_id)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">{slugToName(s.track_id)}</td>
                  <td className="px-4 py-3"><SessionBadge type={s.session_types} /></td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{s.laps}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatDistance(s.distance_km)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                    {formatLapTime(s.best_lap_ms)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SessionDetailPanel data={panel} onClose={closePanel} />
    </>
  );
}

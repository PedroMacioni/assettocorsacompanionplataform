"use client";

import { useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { SessionDetailPanel, type SessionPanelData } from "@/components/SessionDetailPanel";
import { PageLoader } from "@/components/PageLoader";
import { formatLapTime, formatDistance, slugToName } from "@/lib/format";
import type { Session } from "@/lib/types";

interface Props {
  sessions: Session[];
  targetUserId: string;
  carNames: Record<string, string>;
  trackNames: Record<string, string>;
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

const SESSION_BADGE: Record<string, string> = {
  Hotlap: "bg-primary/[0.12] text-primary border border-primary/[0.18]",
  Race: "bg-green-500/[0.12] text-green-500 border border-green-500/[0.18]",
  Practice: "bg-muted-foreground/[0.12] text-muted-foreground border border-muted-foreground/[0.18]",
  "Time Attack": "bg-blue-500/[0.12] text-blue-500 border border-blue-500/[0.18]",
};

function badgeClass(type: string | null) {
  if (!type) return null;
  return SESSION_BADGE[type] ?? "bg-muted-foreground/[0.12] text-muted-foreground border border-muted-foreground/[0.18]";
}

export function FriendSessionsSection({ sessions, targetUserId, carNames, trackNames }: Props) {
  const t = useTranslations("Profile");
  const locale = useLocale();
  const [panel, setPanel] = useState<SessionPanelData | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const openSession = useCallback(
    async (sourceId: string) => {
      if (loadingId) return;
      setLoadingId(sourceId);
      try {
        const res = await fetch(`/api/users/${targetUserId}/sessions/${sourceId}`);
        if (res.ok) setPanel(await res.json());
      } finally {
        setLoadingId(null);
      }
    },
    [loadingId, targetUserId]
  );

  if (sessions.length === 0) {
    return (
      <div className="bg-card border border-border rounded-md p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("noSessions")}</p>
      </div>
    );
  }

  if (panel) {
    return <SessionDetailPanel data={panel} onClose={() => setPanel(null)} />;
  }

  return (
    <>
      <div className="bg-card border border-border rounded-md overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[5rem_1fr_1fr_5rem] sm:grid-cols-[5rem_1fr_1fr_5rem_5rem_4rem] gap-3 px-5 py-2.5 bg-muted/30 border-b border-border">
          {[t("col.date"), t("col.car"), t("col.track"), t("col.bestLap")].map((h) => (
            <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {h}
            </span>
          ))}
          <span className="hidden sm:block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("col.distance")}
          </span>
          <span className="hidden sm:block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("col.type")}
          </span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {sessions.map((s) => {
            const isLoading = loadingId === s.source_id;
            const carName = carNames[s.car_id] ?? slugToName(s.car_id);
            const trackName = trackNames[s.track_id] ?? slugToName(s.track_id);
            const badge = badgeClass(s.session_types);

            return (
              <button
                key={s.id}
                onClick={() => openSession(s.source_id)}
                disabled={!!loadingId}
                className="w-full grid grid-cols-[5rem_1fr_1fr_5rem] sm:grid-cols-[5rem_1fr_1fr_5rem_5rem_4rem] gap-3 px-5 py-3 items-center text-left hover:bg-muted/20 transition-colors disabled:opacity-60 cursor-pointer"
              >
                <span className="text-xs text-muted-foreground tabular-nums">
                  {isLoading ? (
                    <span className="inline-block w-3 h-3 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                  ) : (
                    formatDate(s.started_at, locale)
                  )}
                </span>
                <span className="text-sm text-foreground truncate">{carName}</span>
                <span className="text-sm text-muted-foreground truncate">{trackName}</span>
                <span className="text-sm font-bold font-mono text-foreground">
                  {s.best_lap_ms ? formatLapTime(s.best_lap_ms) : "—"}
                </span>
                <span className="hidden sm:block text-xs text-muted-foreground">
                  {s.distance_km ? formatDistance(s.distance_km) : "—"}
                </span>
                <span className="hidden sm:flex items-center">
                  {badge && s.session_types ? (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badge}`}>
                      {s.session_types}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

    </>
  );
}

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { slugToName } from "@/lib/format";

const PaceLineChart = dynamic(() => import("@/components/charts/PaceLineChart"), {
  ssr: false,
  loading: () => <div className="h-[220px] bg-muted rounded-md animate-pulse" />,
});

export interface ComboData {
  car_id: string;
  track_id: string;
  sessions: { date: string; best_lap_ms: number }[];
}

interface ComboProgressCardProps {
  combos: ComboData[];
  initialComboIndex: number;
}

export function ComboProgressCard({ combos, initialComboIndex }: ComboProgressCardProps) {
  const t = useTranslations("ComboProgress");
  const [selected, setSelected] = useState(initialComboIndex);

  if (combos.length === 0) return null;

  const combo = combos[Math.min(selected, combos.length - 1)];
  const comboKey = `${combo.car_id}__${combo.track_id}`;
  const chartData = combo.sessions.map((s) => ({ date: s.date, [comboKey]: s.best_lap_ms }));

  const first = combo.sessions[0]?.best_lap_ms;
  const last = combo.sessions[combo.sessions.length - 1]?.best_lap_ms;
  const deltaMs = first && last ? last - first : null;

  return (
    <div className="bg-card border border-border rounded-md p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            {t("title")}
          </p>
          <p className="text-sm font-medium text-foreground">
            {slugToName(combo.track_id)}
            <span className="text-muted-foreground"> · </span>
            {slugToName(combo.car_id)}
          </p>
        </div>

        {combos.length > 1 && (
          <select
            value={selected}
            onChange={(e) => setSelected(Number(e.target.value))}
            className="bg-card border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:border-primary outline-none shrink-0 self-start"
          >
            {combos.map((c, i) => (
              <option key={i} value={i}>
                {slugToName(c.track_id)} · {slugToName(c.car_id)}
              </option>
            ))}
          </select>
        )}
      </div>

      {combo.sessions.length >= 2 ? (
        <>
          <PaceLineChart
            data={chartData}
            tracks={[comboKey]}
            trackLabels={{ [comboKey]: `${slugToName(combo.track_id)} · ${slugToName(combo.car_id)}` }}
          />
          {deltaMs !== null && (
            <p
              className={`text-xs mt-3 ${
                deltaMs < 0 ? "text-green-500" : "text-muted-foreground"
              }`}
            >
              {deltaMs < 0
                ? t("improved", { delta: (Math.abs(deltaMs) / 1000).toFixed(3) })
                : t("noImprovement")}
              {" · "}
              {t("sessionsCount", { count: combo.sessions.length })}
            </p>
          )}
        </>
      ) : (
        <div className="h-[140px] flex items-center justify-center text-sm text-muted-foreground">
          {t("needMoreSessions")}
        </div>
      )}
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { formatLapTime } from "@/lib/format";
import type { TelemetryPoint } from "@/lib/types";
import { computeLapStats } from "./track-map-utils";

interface Props {
  points: TelemetryPoint[];
  maxSpeed: number;
  bestS1: number | null;
  bestS2: number | null;
  bestS3: number | null;
  consistData: { score: number; labelKey: string; barColor: string } | null;
  theoretical: number | null;
}

function formatSector(ms: number | null) {
  if (!ms || ms <= 0) return "—";
  const s = Math.floor(ms / 1000);
  const m = ms % 1000;
  return `${s}.${String(m).padStart(3, "0")}`;
}

export function MapStatsPanel({
  points,
  maxSpeed,
  bestS1,
  bestS2,
  bestS3,
  consistData,
  theoretical,
}: Props) {
  const t = useTranslations("SessionDetail");
  const tMap = useTranslations("MapStats");
  const stats = computeLapStats(points, maxSpeed);

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Speed Stats */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{tMap("vmax")}</span>
          <span className="text-sm font-mono font-bold text-blue-400 tabular-nums">{stats.maxSpeed} km/h</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{tMap("vmin")}</span>
          <span className="text-sm font-mono font-bold text-amber-400 tabular-nums">{stats.minSpeed} km/h</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{tMap("vavg")}</span>
          <span className="text-sm font-mono text-foreground tabular-nums">{stats.avgSpeed} km/h</span>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Throttle % */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{tMap("fullThrottle")}</span>
        <span className="text-sm font-mono text-green-400 tabular-nums">{stats.pctFullThrottle}%</span>
      </div>

      {/* Consistency */}
      {consistData && (
        <>
          <div className="h-px bg-border" />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("consistency.title")}</span>
              <span className="text-sm font-mono text-foreground tabular-nums">{consistData.score}/100</span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${consistData.barColor}`}
                style={{ width: `${consistData.score}%` }}
              />
            </div>
          </div>
        </>
      )}

      {/* Theoretical Best */}
      {theoretical !== null && (
        <>
          <div className="h-px bg-border" />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("theoretical.title")}</span>
              <span className="text-sm font-mono font-bold text-foreground tabular-nums">{formatLapTime(theoretical)}</span>
            </div>
            <div className="flex gap-3 text-[10px]">
              {([["S1", bestS1], ["S2", bestS2], ["S3", bestS3]] as [string, number | null][]).map(([label, v]) => (
                <div key={label} className="flex items-center gap-1">
                  <span className="font-bold text-purple-400">{label}</span>
                  <span className="font-mono text-foreground tabular-nums">{formatSector(v)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

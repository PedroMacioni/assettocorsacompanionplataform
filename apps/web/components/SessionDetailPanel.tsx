"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Filter } from "lucide-react";
import { formatLapTime, formatDistance, formatDate, slugToName } from "@/lib/format";
import type { Session, PersonalBest, Lap } from "@/lib/types";

// ─── public types ─────────────────────────────────────────────────────────────

export type SessionPanelData = {
  session: Session;
  laps: Lap[];
  pb: PersonalBest | null;
  trackSessions: Session[];
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const SESSION_BADGE: Record<string, string> = {
  Hotlap:        "bg-primary/[0.12] text-primary border border-primary/[0.18]",
  Race:          "bg-green-500/[0.12] text-green-500 border border-green-500/[0.18]",
  Practice:      "bg-muted-foreground/[0.12] text-muted-foreground border border-muted-foreground/[0.18]",
  "Time Attack": "bg-blue-500/[0.12] text-blue-500 border border-blue-500/[0.18]",
};

function badgeClass(type: string | null) {
  if (!type) return null;
  return SESSION_BADGE[type] ?? "bg-muted-foreground/[0.12] text-muted-foreground border border-muted-foreground/[0.18]";
}

function formatDelta(ms: number) {
  return `${ms < 0 ? "" : "+"}${(ms / 1000).toFixed(3)}s`;
}

function formatSector(ms: number | null) {
  if (!ms || ms <= 0) return "—";
  const s = Math.floor(ms / 1000);
  const m = ms % 1000;
  return `${s}.${String(m).padStart(3, "0")}`;
}

function stdDev(arr: number[]) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

type SectorColor = "purple" | "green" | "yellow" | "red" | "grey";

const SECTOR_TEXT: Record<SectorColor, string> = {
  purple: "text-purple-400 font-semibold",
  green:  "text-green-400 font-semibold",
  yellow: "text-yellow-400",
  red:    "text-red-400",
  grey:   "text-muted-foreground/50",
};

const SECTOR_DOT: Record<SectorColor, string> = {
  purple: "bg-purple-400",
  green:  "bg-green-400",
  yellow: "bg-yellow-400",
  red:    "bg-red-500",
  grey:   "bg-muted-foreground/30",
};

function classifySector(
  v: number | null,
  best: number | null,
  p25: number,
  p75: number,
  cut: boolean,
): SectorColor {
  if (!v || cut) return "grey";
  if (best !== null && v === best) return "purple";
  if (v <= p25) return "green";
  if (v <= p75) return "yellow";
  return "red";
}

type ConsistencyKey = "excellent" | "good" | "regular" | "variable" | "inconsistent";

function getConsistencyInfo(sigmaMs: number) {
  // 0ms → 100, 2000ms → 0
  const score = Math.max(0, Math.round(100 - sigmaMs / 20));
  let labelKey: ConsistencyKey;
  let barColor: string;
  if (score >= 85)      { labelKey = "excellent";    barColor = "bg-green-400"; }
  else if (score >= 70) { labelKey = "good";          barColor = "bg-emerald-400"; }
  else if (score >= 50) { labelKey = "regular";       barColor = "bg-yellow-400"; }
  else if (score >= 30) { labelKey = "variable";      barColor = "bg-orange-400"; }
  else                  { labelKey = "inconsistent";  barColor = "bg-red-400"; }
  return { score, labelKey, barColor };
}

// ─── component ────────────────────────────────────────────────────────────────

export function SessionDetailPanel({
  data,
  onClose,
}: {
  data: SessionPanelData | null;
  onClose: () => void;
}) {
  const t = useTranslations("SessionDetail");
  const [showValidOnly, setShowValidOnly] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!data) return null;

  const { session: s, laps, pb } = data;

  // ── analytics ──────────────────────────────────────────────────────────────
  const validLaps = laps.filter((l) => l.cuts === 0 && l.time_ms > 0);
  const lapTimes  = validLaps.map((l) => l.time_ms);
  const bestLapMs = lapTimes.length > 0 ? Math.min(...lapTimes) : s.best_lap_ms;
  const pbDelta   = pb && bestLapMs ? bestLapMs - pb.time_ms : null;
  const avgLapMs  = lapTimes.length > 0
    ? lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length
    : null;

  const s1Times = validLaps.map((l) => l.s1_ms).filter((v): v is number => v !== null && v > 0);
  const s2Times = validLaps.map((l) => l.s2_ms).filter((v): v is number => v !== null && v > 0);
  const s3Times = validLaps.map((l) => l.s3_ms).filter((v): v is number => v !== null && v > 0);

  const bestS1 = s1Times.length ? Math.min(...s1Times) : null;
  const bestS2 = s2Times.length ? Math.min(...s2Times) : null;
  const bestS3 = s3Times.length ? Math.min(...s3Times) : null;
  const theoretical =
    bestS1 !== null && bestS2 !== null && bestS3 !== null
      ? bestS1 + bestS2 + bestS3
      : null;

  const consistency = lapTimes.length >= 2 ? stdDev(lapTimes) : null;
  const cutLaps     = laps.filter((l) => l.cuts > 0).length;
  const hasLaps     = laps.length > 0;

  const s1Sorted = [...s1Times].sort((a, b) => a - b);
  const s2Sorted = [...s2Times].sort((a, b) => a - b);
  const s3Sorted = [...s3Times].sort((a, b) => a - b);
  const s1P25 = percentile(s1Sorted, 25), s1P75 = percentile(s1Sorted, 75);
  const s2P25 = percentile(s2Sorted, 25), s2P75 = percentile(s2Sorted, 75);
  const s3P25 = percentile(s3Sorted, 25), s3P75 = percentile(s3Sorted, 75);

  const filteredLaps  = showValidOnly ? validLaps : laps;
  const consistData   = consistency !== null ? getConsistencyInfo(consistency) : null;

  // Most common tyre compound
  const tyreList = laps.map((l) => l.tyre).filter(Boolean) as string[];
  const mainTyre = tyreList.length
    ? Object.entries(
        tyreList.reduce((acc, t) => ({ ...acc, [t]: (acc[t] ?? 0) + 1 }), {} as Record<string, number>),
      ).sort(([, a], [, b]) => b - a)[0]?.[0]
    : null;

  type StatCard = { label: string; value: string; accent?: boolean };
  const statCards: StatCard[] = [
    { label: t("stats.totalLaps"), value: String(s.laps) },
    { label: t("stats.valid"),     value: hasLaps ? `${validLaps.length} / ${laps.length}` : String(s.laps) },
    { label: t("stats.distance"),  value: formatDistance(s.distance_km) },
    { label: t("stats.lastLap"),   value: formatLapTime(s.last_lap_ms) },
    { label: t("stats.avgLap"),    value: avgLapMs ? formatLapTime(avgLapMs) : "—" },
    { label: t("stats.cuts"),      value: hasLaps ? String(cutLaps) : "—", accent: cutLaps > 0 },
    ...(mainTyre ? [{ label: t("stats.tyre"), value: mainTyre.toUpperCase() }] : []),
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("backToSessions")}
        </button>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6 lg:gap-10">

          {/* Session info */}
          <div className="flex-1 min-w-0">
            {s.session_types && (
              <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide mb-2 ${badgeClass(s.session_types) ?? ""}`}>
                {s.session_types}
              </span>
            )}
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight tracking-tight">
              {slugToName(s.track_id)}
            </h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <p className="text-sm text-muted-foreground">{slugToName(s.car_id)}</p>
              <span className="text-muted-foreground/30 text-xs">•</span>
              <p className="text-sm text-muted-foreground">{formatDate(s.started_at)}</p>
            </div>
          </div>

          {/* Metrics */}
          <div className="flex items-center gap-0 shrink-0">
            <div className="text-center pr-6 sm:pr-8 border-r border-border shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                {t("bestLap")}
              </p>
              <p className="text-3xl md:text-4xl font-bold font-mono text-foreground tabular-nums">
                {formatLapTime(bestLapMs)}
              </p>
            </div>

            {pb && bestLapMs && pbDelta !== null ? (
              <div className="text-center pl-6 sm:pl-8 border-r border-border pr-6 sm:pr-8 shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  {t("vsPb")}
                </p>
                <p className={`text-2xl md:text-3xl font-bold font-mono tabular-nums ${pbDelta <= 0 ? "text-green-400" : "text-orange-400"}`}>
                  {formatDelta(pbDelta)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{t("pb")}: {formatLapTime(pb.time_ms)}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-border" />

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-5">

        {/* ── Left: stats panel ────────────────────────────────────────────── */}
        <div className="w-full md:w-72 lg:w-80 shrink-0 space-y-4">

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-2.5">
              {statCards.map(({ label, value, accent }) => (
                <div key={label} className="bg-card border border-border rounded-xl p-3.5">
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                    {label}
                  </p>
                  <p className={`font-bold text-sm leading-tight ${accent ? "text-red-400" : "text-foreground"}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Consistency */}
            {consistData && (
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  {t("consistency.title")}
                </p>
                <div className="flex items-baseline gap-1.5 mb-2.5">
                  <span className="text-3xl font-bold text-foreground tabular-nums">
                    {consistData.score}
                  </span>
                  <span className="text-xs text-muted-foreground">{t("consistency.outOf")}</span>
                  <span className="ml-auto text-sm font-medium text-muted-foreground">
                    {t(`consistency.${consistData.labelKey}`)}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${consistData.barColor}`}
                    style={{ width: `${consistData.score}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {t("consistency.sigma", { value: (consistency! / 1000).toFixed(3) })}
                </p>
              </div>
            )}

            {/* Theoretical best */}
            {theoretical !== null && (
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  {t("theoretical.title")}
                </p>
                <p className="font-mono font-bold text-xl text-foreground tabular-nums">
                  {formatLapTime(theoretical)}
                </p>
                {bestLapMs && (
                  <p className="text-xs text-green-400 font-medium mt-0.5">
                    {t("theoretical.potentialGain", { value: formatDelta(theoretical - bestLapMs) })}
                  </p>
                )}
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {(
                    [
                      ["S1", bestS1],
                      ["S2", bestS2],
                      ["S3", bestS3],
                    ] as [string, number | null][]
                  ).map(([label, v]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-purple-400">{label}</span>
                      <span className="font-mono text-xs text-foreground tabular-nums">
                        {formatSector(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>

        {/* ── Right: lap table ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">

            {hasLaps ? (
              <>
                {/* Filter bar */}
                <div className="flex flex-wrap items-center gap-3 px-4 md:px-5 py-3 border border-border rounded-t-xl bg-muted/5">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowValidOnly(!showValidOnly)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        showValidOnly
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <Filter className="h-3 w-3" />
                      {t("table.validOnly")}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {t("table.lapsCount", { count: filteredLaps.length })}
                    </span>
                  </div>

                  {/* Legend — hidden on small screens */}
                  <div className="hidden sm:flex items-center gap-3 ml-auto">
                    {(
                      [
                        ["purple", t("table.legend.best")],
                        ["green",  t("table.legend.top25")],
                        ["yellow", t("table.legend.top50")],
                        ["red",    t("table.legend.worst")],
                        ["grey",   t("table.legend.cut")],
                      ] as [SectorColor, string][]
                    ).map(([c, l]) => (
                      <span key={c} className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                        <span className={`w-2 h-2 rounded-full ${SECTOR_DOT[c]}`} />
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto apex-scroll border border-t-0 border-border rounded-b-xl">
                  <table className="w-full text-xs min-w-[600px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-border bg-background">
                        {(
                          [
                            t("table.headers.lap"),
                            t("table.headers.s1"),
                            t("table.headers.s2"),
                            t("table.headers.s3"),
                            t("table.headers.total"),
                            t("table.headers.gap"),
                            t("table.headers.tyre"),
                            t("table.headers.cuts"),
                          ] as string[]
                        ).map((h, i) => (
                          <th
                            key={h}
                            className={`px-4 py-3 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground ${i > 0 ? "text-right" : "text-left"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLaps.map((lap) => {
                        const cut    = lap.cuts > 0;
                        const isBest = !cut && lap.time_ms === bestLapMs;
                        const gap    = bestLapMs !== null && !cut ? lap.time_ms - bestLapMs : null;
                        const c1 = classifySector(lap.s1_ms, bestS1, s1P25, s1P75, cut);
                        const c2 = classifySector(lap.s2_ms, bestS2, s2P25, s2P75, cut);
                        const c3 = classifySector(lap.s3_ms, bestS3, s3P25, s3P75, cut);

                        return (
                          <tr
                            key={lap.id}
                            className={`border-b border-border last:border-0 transition-colors ${
                              isBest ? "bg-primary/[0.07]" : "hover:bg-muted/20"
                            }`}
                          >
                            <td className="px-4 py-2.5">
                              <span className={isBest ? "text-primary font-bold" : "text-muted-foreground"}>
                                {lap.lap_number + 1}
                              </span>
                            </td>
                            <td className={`px-4 py-2.5 text-right font-mono tabular-nums ${SECTOR_TEXT[c1]}`}>
                              {formatSector(lap.s1_ms)}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-mono tabular-nums ${SECTOR_TEXT[c2]}`}>
                              {formatSector(lap.s2_ms)}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-mono tabular-nums ${SECTOR_TEXT[c3]}`}>
                              {formatSector(lap.s3_ms)}
                            </td>
                            <td
                              className={`px-4 py-2.5 text-right font-mono tabular-nums font-semibold ${
                                cut
                                  ? "text-muted-foreground/50 line-through"
                                  : isBest
                                  ? "text-primary"
                                  : "text-foreground"
                              }`}
                            >
                              {formatLapTime(lap.time_ms)}
                            </td>
                            <td
                              className={`px-4 py-2.5 text-right font-mono tabular-nums ${
                                cut
                                  ? "text-muted-foreground/40"
                                  : gap === 0
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {cut ? "—" : gap === null ? "—" : gap === 0 ? t("table.ref") : formatDelta(gap)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground font-mono uppercase text-[10px]">
                              {lap.tyre ?? "—"}
                            </td>
                            <td
                              className={`px-4 py-2.5 text-right ${
                                lap.cuts > 0 ? "text-red-400 font-semibold" : "text-muted-foreground/40"
                              }`}
                            >
                              {lap.cuts > 0 ? lap.cuts : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center p-8">
                  <p className="text-sm text-muted-foreground">{t("table.empty")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("table.emptyHint")}</p>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

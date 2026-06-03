"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Share2, Filter, MapPin } from "lucide-react";
import { formatLapTime, formatDistance, formatDate, slugToName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Session, PersonalBest, Lap, SessionWithMeta, Track, LapTelemetry } from "@/lib/types";
import { ShareSessionModal } from "../share-session-modal";
import { LapChart } from "./LapChart";
import { TrackMap } from "./TrackMap";
import { MapAnalysis } from "./MapAnalysis";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionDetailData = {
  session: Session;
  laps: Lap[];
  pb: PersonalBest | null;
  trackSessions: Session[];
  track: Track | null;
  telemetry: LapTelemetry | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function classifySector(v: number | null, best: number | null, p25: number, p75: number, cut: boolean): SectorColor {
  if (!v || cut) return "grey";
  if (best !== null && v === best) return "purple";
  if (v <= p25) return "green";
  if (v <= p75) return "yellow";
  return "red";
}

type ConsistencyKey = "excellent" | "good" | "regular" | "variable" | "inconsistent";

function getConsistencyInfo(sigmaMs: number) {
  const score = Math.max(0, Math.round(100 - sigmaMs / 20));
  let labelKey: ConsistencyKey;
  let barColor: string;
  if (score >= 85)      { labelKey = "excellent";   barColor = "bg-green-400"; }
  else if (score >= 70) { labelKey = "good";         barColor = "bg-emerald-400"; }
  else if (score >= 50) { labelKey = "regular";      barColor = "bg-yellow-400"; }
  else if (score >= 30) { labelKey = "variable";     barColor = "bg-orange-400"; }
  else                  { labelKey = "inconsistent"; barColor = "bg-red-400"; }
  return { score, labelKey, barColor };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SessionDetailContent({ data }: { data: SessionDetailData }) {
  const t = useTranslations("SessionDetail");
  const tShare = useTranslations("Sessions.share");
  const router = useRouter();
  const [showValidOnly, setShowValidOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "laps">("overview");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTheme, setShareTheme] = useState<"dark" | "light">("dark");

  const { session: s, laps, pb, track } = data;

  // ── Analytics ──────────────────────────────────────────────────────────────
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

  const tyreList = laps.map((l) => l.tyre).filter(Boolean) as string[];
  const mainTyre = tyreList.length
    ? Object.entries(
        tyreList.reduce((acc, t) => ({ ...acc, [t]: (acc[t] ?? 0) + 1 }), {} as Record<string, number>),
      ).sort(([, a], [, b]) => b - a)[0]?.[0]
    : null;

  const sessionWithMeta: SessionWithMeta = {
    ...s,
    deltaPbMs: pbDelta,
    badge: pbDelta !== null && pbDelta <= 0 ? "new_pb" : null,
  };

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/sessions");
    }
  }

  function handleOpenShare() {
    const savedTheme = typeof window !== "undefined" ? window.localStorage.getItem("apex-theme") : null;
    setShareTheme(savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark");
    setShareOpen(true);
  }

  return (
    <div className="space-y-5">

      {/* ── Back + Share row ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 py-2 px-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors -ml-1"
        >
          <ArrowLeft className="size-5" />
          {t("backToSessions")}
        </button>

        <button
          onClick={handleOpenShare}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-control-hover transition-colors"
        >
          <Share2 className="size-4" />
          {tShare("title")}
        </button>
      </div>

      {/* ── Session Header ────────────────────────────────────────────────── */}
      <div>
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
          <span className="text-muted-foreground/30 text-xs">·</span>
          <p className="text-sm text-muted-foreground">{formatDate(s.started_at)}</p>
        </div>

        {/* Hero Metrics — Best | Avg | vs PB */}
        <div className="flex items-stretch mt-5 gap-0 overflow-x-auto">
          {/* Best lap */}
          <div className="text-center pr-6 sm:pr-8 border-r border-border shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              {t("bestLap")}
            </p>
            <p className="text-3xl md:text-4xl font-bold font-mono text-foreground tabular-nums">
              {formatLapTime(bestLapMs)}
            </p>
          </div>

          {/* Avg (valid) */}
          {avgLapMs !== null && bestLapMs !== null && (
            <div className="text-center px-6 sm:px-8 border-r border-border shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                {t("stats.avgLap")}
              </p>
              <p className="text-3xl md:text-4xl font-bold font-mono text-foreground tabular-nums">
                {formatLapTime(avgLapMs)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                {formatDelta(avgLapMs - bestLapMs)} vs melhor
              </p>
            </div>
          )}

          {/* vs PB */}
          {pb && bestLapMs && pbDelta !== null && (
            <div className="text-center pl-6 sm:pl-8 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                {t("vsPb")}
              </p>
              <p className={`text-3xl md:text-4xl font-bold font-mono tabular-nums ${pbDelta <= 0 ? "text-green-400" : "text-orange-400"}`}>
                {formatDelta(pbDelta)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                {t("pb")}: {formatLapTime(pb.time_ms)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats chips row ───────────────────────────────────────────────── */}
      {hasLaps && (
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2.5 py-1 rounded-md bg-control text-xs text-muted-foreground font-medium">
            {t("statsRow.laps", { count: laps.length })}
          </span>
          {validLaps.length < laps.length && (
            <span className="px-2.5 py-1 rounded-md bg-control text-xs text-green-400 font-medium">
              {t("statsRow.valid", { count: validLaps.length })}
            </span>
          )}
          {cutLaps > 0 ? (
            <span className="px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium">
              {t("statsRow.cuts", { count: cutLaps })}
            </span>
          ) : validLaps.length > 0 ? (
            <span className="px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-xs text-green-400 font-medium">
              {t("statsRow.noCuts")}
            </span>
          ) : null}
          {s.distance_km && s.distance_km > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-control text-xs text-muted-foreground font-medium">
              {formatDistance(s.distance_km)}
            </span>
          )}
          {mainTyre && (
            <span className="px-2.5 py-1 rounded-md bg-control text-xs text-muted-foreground font-medium uppercase">
              {mainTyre}
            </span>
          )}
        </div>
      )}

      <div className="w-full h-px bg-border" />

      {/* ── Mobile Tabs ───────────────────────────────────────────────────── */}
      <div className="flex md:hidden border-b border-border -mt-2">
        {(["overview", "laps"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab
                ? "text-foreground border-b-2 border-primary -mb-px"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>

{/* ── Overview Section ─────────────────────────────────────────────── */}
<div className={cn(activeTab !== "overview" && "hidden md:block")}>

  {/* MapAnalysis no topo quando há telemetria */}
  {data.telemetry && (
    <div className="mb-5">
      <MapAnalysis
        telemetry={data.telemetry}
        bestS1={bestS1}
        bestS2={bestS2}
        bestS3={bestS3}
        consistData={consistData}
        theoretical={theoretical}
      />
    </div>
  )}

  <div className="flex flex-col md:flex-row gap-5">
    {/* ── Left: Chart ──────────────────────────────────── */}
    <div className="flex-1 min-w-0 space-y-4">
      {/* Pace chart */}
      {hasLaps && (
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            {t("chart.title")}
          </p>
          <LapChart laps={laps} bestLapMs={bestLapMs} />

          {/* Chart legend */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {(
              [
                ["purple", t("table.legend.best")],
                ["green",  t("table.legend.top25")],
                ["yellow", t("table.legend.top50")],
                ["red",    t("table.legend.worst")],
                ["grey",   t("table.legend.cut")],
              ] as [SectorColor, string][]
            ).map(([c, l]) => (
              <span key={c} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className={`w-2 h-2 rounded-full ${SECTOR_DOT[c]}`} />
                {l}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>

    {/* ── Right: Analysis Sidebar ────────────────────────────────── */}
    <div className="w-full md:w-72 lg:w-80 shrink-0">
      <div className="bg-card border border-border rounded-xl overflow-hidden">

        {/* Track map / outline - só mostra se NÃO tiver telemetria (pois já está no MapAnalysis) */}
        {!data.telemetry && (
          track?.outline_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.outline_url}
              alt={track.name}
              className="w-full h-44 object-contain bg-muted/40 p-5"
            />
          ) : track ? (
            <div className="w-full h-28 bg-muted/40 flex flex-col items-center justify-center gap-2">
              <MapPin className="size-7 text-muted-foreground/20" />
              <p className="text-[10px] text-muted-foreground/50">Telemetria disponível em sessões futuras</p>
            </div>
          ) : null
        )}

        <div className={cn("p-5 space-y-4", (track || data.telemetry) && !data.telemetry && "border-t border-border")}>

          {/* Consistency */}
          {consistData && (
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("consistency.title")}
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  {t(`consistency.${consistData.labelKey}`)}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-bold text-foreground tabular-nums">{consistData.score}</span>
                <span className="text-xs text-muted-foreground">{t("consistency.outOf")}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${consistData.barColor}`}
                  style={{ width: `${consistData.score}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {t("consistency.sigma", { value: (consistency! / 1000).toFixed(3) })}
              </p>
            </div>
          )}

          {consistData && <div className="h-px bg-border" />}

          {/* Lap metadata */}
          <div className="space-y-2">
            {hasLaps && (
              <p className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-1">
                <span>{t("stats.validOf", { valid: validLaps.length, total: laps.length })}</span>
                {mainTyre && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="uppercase">{mainTyre}</span>
                  </>
                )}
                {s.distance_km && s.distance_km > 0 && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
                    <span>{formatDistance(s.distance_km)}</span>
                  </>
                )}
              </p>
            )}
          </div>

          {/* Theoretical Best */}
          {theoretical !== null && (
            <>
              <div className="h-px bg-border" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  {t("theoretical.title")}
                </p>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono font-bold text-xl text-foreground tabular-nums">
                    {formatLapTime(theoretical)}
                  </span>
                  {bestLapMs && (
                    <span className="text-xs text-green-400 font-medium">
                      {t("theoretical.potentialGain", { value: formatDelta(theoretical - bestLapMs) })}
                    </span>
                  )}
                </div>
                <div className="flex gap-4 mt-2.5">
                  {([["S1", bestS1], ["S2", bestS2], ["S3", bestS3]] as [string, number | null][]).map(([label, v]) => (
                    <div key={label}>
                      <span className="text-[10px] font-bold text-purple-400">{label}</span>
                      <span className="font-mono text-xs text-foreground tabular-nums ml-1.5">
                        {formatSector(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  </div>

  {/* Track history - formato compacto no rodapé */}
  {data.trackSessions.length > 0 && (
    <div className="mt-5 bg-card border border-border rounded-xl p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        {t("history.title")}
      </p>
      <div className="flex flex-wrap gap-3">
        {data.trackSessions.slice(0, 4).map((ts) => {
          const delta = bestLapMs && ts.best_lap_ms ? ts.best_lap_ms - bestLapMs : null;
          const isBetter = delta !== null && delta < 0;
          const isWorse  = delta !== null && delta > 0;
          return (
            <div
              key={ts.source_id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 border border-border/50"
            >
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground truncate">
                  {formatDate(ts.started_at)}
                </p>
                <p className="text-xs font-mono font-semibold text-foreground tabular-nums">
                  {formatLapTime(ts.best_lap_ms)}
                </p>
              </div>
              {delta !== null && (
                <span className={cn(
                  "text-[10px] font-mono tabular-nums",
                  isBetter ? "text-green-400" : isWorse ? "text-orange-400" : "text-muted-foreground",
                )}>
                  {formatDelta(delta)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  )}
</div>

      {/* ── Laps Section ─────────────────────────────────────────────────── */}
      <div className={cn(activeTab !== "laps" && "hidden md:block")}>
        {hasLaps ? (
          <>
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3 px-4 md:px-5 py-3 border border-border rounded-t-xl bg-surface-raised/40">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowValidOnly(!showValidOnly)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    showValidOnly
                      ? "bg-primary text-primary-foreground"
                      : "bg-control text-muted-foreground hover:text-foreground hover:bg-control-hover"
                  }`}
                >
                  <Filter className="h-3 w-3" />
                  {t("table.validOnly")}
                </button>
                <span className="text-xs text-muted-foreground">
                  {t("table.lapsCount", { count: filteredLaps.length })}
                </span>
              </div>

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
                  <tr className="border-b border-border bg-surface-raised/40">
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
                          isBest
                            ? "bg-primary/[0.07] border-l-2 border-l-primary"
                            : "hover:bg-control-hover"
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
          <div className="flex items-center justify-center py-16 border border-border rounded-xl">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{t("table.empty")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("table.emptyHint")}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Share Modal ───────────────────────────────────────────────────── */}
      <ShareSessionModal
        session={shareOpen ? sessionWithMeta : null}
        open={shareOpen}
        theme={shareTheme}
        onThemeChange={setShareTheme}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}

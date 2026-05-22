"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { formatLapTime, formatDistance, formatDate, slugToName } from "@/lib/format";
import type { Session, PersonalBest, Lap } from "@/lib/types";

// ─── public types ─────────────────────────────────────────────────────────────

export type SessionPanelData = {
  session: Session;
  laps: Lap[];
  pb: PersonalBest | null;
  trackSessions: Session[];
};

// ─── internal helpers ─────────────────────────────────────────────────────────

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

// ─── component ────────────────────────────────────────────────────────────────

export function SessionDetailPanel({
  data,
  onClose,
}: {
  data: SessionPanelData | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = data ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [data]);

  if (!data) return null;

  const { session: s, laps, pb, trackSessions } = data;

  // ── analytics ──────────────────────────────────────────────────────────────
  const validLaps = laps.filter((l) => l.cuts === 0 && l.time_ms > 0);
  const lapTimes  = validLaps.map((l) => l.time_ms);
  const bestLapMs = lapTimes.length > 0 ? Math.min(...lapTimes) : s.best_lap_ms;
  const pbDelta   = pb && bestLapMs ? bestLapMs - pb.time_ms : null;

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

  const stats = [
    { label: "Voltas",    value: String(s.laps) },
    { label: "Válidas",   value: hasLaps ? `${validLaps.length} / ${laps.length}` : String(s.laps) },
    { label: "Distância", value: formatDistance(s.distance_km) },
    { label: "Melhor",    value: formatLapTime(bestLapMs), hero: true },
    { label: "Última",    value: formatLapTime(s.last_lap_ms) },
    {
      label: "Teórica",
      value: formatLapTime(theoretical),
      sub: theoretical && bestLapMs ? formatDelta(theoretical - bestLapMs) : undefined,
    },
    {
      label: "Consist. σ",
      value: consistency !== null ? `${(consistency / 1000).toFixed(3)}s` : "—",
      sub: consistency !== null
        ? consistency < 500 ? "Excelente" : consistency < 1500 ? "Bom" : "Variável"
        : undefined,
    },
    { label: "c/ Corte", value: hasLaps ? String(cutLaps) : "—" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-screen z-50 flex flex-col bg-background border-l border-border shadow-2xl"
        style={{ width: "min(800px, 90vw)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border shrink-0">
          <div className="min-w-0">
            {s.session_types && (
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${badgeClass(s.session_types) ?? ""}`}
              >
                {s.session_types}
              </span>
            )}
            <h2 className="text-xl font-bold text-foreground leading-tight">{slugToName(s.track_id)}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{slugToName(s.car_id)}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatDate(s.started_at)}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {pb && bestLapMs && pbDelta !== null && (
              <div className="text-right mr-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">vs PB</p>
                <p className={`text-lg font-bold font-mono ${pbDelta <= 0 ? "text-green-400" : "text-red-400"}`}>
                  {formatDelta(pbDelta)}
                </p>
                <p className="text-[10px] text-muted-foreground">PB: {formatLapTime(pb.time_ms)}</p>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2">
            {stats.map(({ label, value, hero, sub }) => (
              <div key={label} className="bg-card border border-border rounded-lg p-3">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  {label}
                </p>
                <p className={`font-bold leading-tight ${hero ? "text-xl font-mono text-primary" : "text-base text-foreground"}`}>
                  {value}
                </p>
                {sub && <p className="text-[9px] text-muted-foreground mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>

          {/* Lap table */}
          {hasLaps ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Voltas</p>
                <div className="flex gap-3">
                  {(
                    [
                      ["purple", "Melhor"],
                      ["green",  "Top 25%"],
                      ["yellow", "Top 50%"],
                      ["red",    "Pior"],
                      ["grey",   "Corte"],
                    ] as [SectorColor, string][]
                  ).map(([c, l]) => (
                    <span key={c} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                      <span className={`w-1.5 h-1.5 rounded-full ${SECTOR_DOT[c]}`} />
                      {l}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["#", "S1", "S2", "S3", "Total", "Gap", "Pneu", "Cortes"].map((h, i) => (
                        <th
                          key={h}
                          className={`px-2.5 py-2 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground ${i > 0 ? "text-right" : "text-left"}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {laps.map((lap) => {
                      const cut    = lap.cuts > 0;
                      const isBest = !cut && lap.time_ms === bestLapMs;
                      const gap    = bestLapMs !== null && !cut ? lap.time_ms - bestLapMs : null;
                      const c1 = classifySector(lap.s1_ms, bestS1, s1P25, s1P75, cut);
                      const c2 = classifySector(lap.s2_ms, bestS2, s2P25, s2P75, cut);
                      const c3 = classifySector(lap.s3_ms, bestS3, s3P25, s3P75, cut);

                      return (
                        <tr
                          key={lap.id}
                          className={`border-b border-border last:border-0 transition-colors ${isBest ? "bg-primary/5" : "hover:bg-muted/30"}`}
                        >
                          <td className="px-2.5 py-1.5 text-muted-foreground">
                            <span className={isBest ? "text-primary font-semibold" : ""}>{lap.lap_number + 1}</span>
                          </td>
                          <td className={`px-2.5 py-1.5 text-right font-mono ${SECTOR_TEXT[c1]}`}>{formatSector(lap.s1_ms)}</td>
                          <td className={`px-2.5 py-1.5 text-right font-mono ${SECTOR_TEXT[c2]}`}>{formatSector(lap.s2_ms)}</td>
                          <td className={`px-2.5 py-1.5 text-right font-mono ${SECTOR_TEXT[c3]}`}>{formatSector(lap.s3_ms)}</td>
                          <td className={`px-2.5 py-1.5 text-right font-mono font-semibold ${cut ? "text-muted-foreground/50 line-through" : isBest ? "text-primary" : "text-foreground"}`}>
                            {formatLapTime(lap.time_ms)}
                          </td>
                          <td className={`px-2.5 py-1.5 text-right font-mono ${cut ? "text-muted-foreground/40" : gap === 0 ? "text-primary" : "text-muted-foreground"}`}>
                            {cut ? "—" : gap === null ? "—" : gap === 0 ? "REF" : formatDelta(gap)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right text-muted-foreground font-mono">{lap.tyre ?? "—"}</td>
                          <td className={`px-2.5 py-1.5 text-right ${lap.cuts > 0 ? "text-red-400 font-semibold" : "text-muted-foreground/50"}`}>
                            {lap.cuts}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Theoretical best breakdown */}
              {theoretical !== null && (
                <div className="mt-2 bg-card border border-border rounded-lg px-4 py-2.5 flex flex-wrap gap-5 items-center">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Volta Teórica</p>
                    <p className="font-mono font-bold text-foreground mt-0.5">{formatLapTime(theoretical)}</p>
                  </div>
                  <div className="flex gap-3 text-xs font-mono text-muted-foreground">
                    <span><span className="text-purple-400">S1</span> {formatSector(bestS1)}</span>
                    <span className="opacity-40">+</span>
                    <span><span className="text-purple-400">S2</span> {formatSector(bestS2)}</span>
                    <span className="opacity-40">+</span>
                    <span><span className="text-purple-400">S3</span> {formatSector(bestS3)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg p-5 text-center">
              <p className="text-sm text-muted-foreground">Dados de volta não disponíveis.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Sincronize pelo agente para importar o detalhamento.
              </p>
            </div>
          )}

          {/* Other sessions at same track */}
          {trackSessions.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Outras sessões — {slugToName(s.track_id)}
              </p>
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Data", "Carro", "Tipo", "Voltas", "Melhor"].map((h, i) => (
                        <th
                          key={h}
                          className={`px-3 py-2 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground ${i >= 3 ? "text-right" : "text-left"}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trackSessions.map((ts) => (
                      <tr key={ts.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(ts.started_at)}</td>
                        <td className="px-3 py-2 font-medium text-foreground">{slugToName(ts.car_id)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{ts.session_types ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{ts.laps}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">{formatLapTime(ts.best_lap_ms)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

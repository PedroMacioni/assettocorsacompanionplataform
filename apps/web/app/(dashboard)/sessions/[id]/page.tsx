import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { formatLapTime, formatDistance, formatDate, slugToName } from "@/lib/format";
import type { Session, PersonalBest, Lap } from "@/lib/types";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// ─── helpers ─────────────────────────────────────────────────────────────────

function sessionBadgeClass(type: string | null): string {
  if (!type) return "";
  const map: Record<string, string> = {
    Hotlap: "bg-primary/[0.12] text-primary border border-primary/[0.18]",
    Race: "bg-green-500/[0.12] text-green-500 border border-green-500/[0.18]",
    Practice: "bg-muted-foreground/[0.12] text-muted-foreground border border-muted-foreground/[0.18]",
  };
  return map[type] ?? "bg-muted-foreground/[0.12] text-muted-foreground border border-muted-foreground/[0.18]";
}

function formatDeltaMs(ms: number): string {
  const sign = ms < 0 ? "" : "+";
  return `${sign}${(ms / 1000).toFixed(3)}s`;
}

function formatSectorTime(ms: number | null): string {
  if (!ms || ms <= 0) return "—";
  const seconds = Math.floor(ms / 1000);
  const millis = ms % 1000;
  return `${seconds}.${String(millis).padStart(3, "0")}`;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
}

// ─── sector colour (F1-style) ─────────────────────────────────────────────────

type SectorColor = "purple" | "green" | "yellow" | "red" | "grey";

function getSectorColorClass(color: SectorColor): string {
  return {
    purple: "text-purple-400 font-semibold",
    green:  "text-green-400 font-semibold",
    yellow: "text-yellow-400",
    red:    "text-red-400",
    grey:   "text-muted-foreground",
  }[color];
}

function getSectorDotClass(color: SectorColor): string {
  return {
    purple: "bg-purple-400",
    green:  "bg-green-400",
    yellow: "bg-yellow-400",
    red:    "bg-red-500",
    grey:   "bg-muted-foreground/40",
  }[color];
}

function classifySector(
  value: number | null,
  best: number | null,
  p25: number,
  p75: number,
  hascuts: boolean,
): SectorColor {
  if (!value || hascuts) return "grey";
  if (best !== null && value === best) return "purple";
  if (value <= p25) return "green";
  if (value <= p75) return "yellow";
  return "red";
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [sessionRes, lapsRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user!.id)
      .eq("source_id", id)
      .maybeSingle(),
    supabase
      .from("laps")
      .select("*")
      .eq("user_id", user!.id)
      .eq("session_source_id", id)
      .order("lap_number", { ascending: true }),
  ]);

  if (!sessionRes.data) notFound();
  const s = sessionRes.data as Session;
  const laps = (lapsRes.data ?? []) as Lap[];

  const [pbRes, trackSessionsRes] = await Promise.all([
    supabase
      .from("personal_bests")
      .select("*")
      .eq("user_id", user!.id)
      .eq("car_id", s.car_id)
      .eq("track_id", s.track_id)
      .maybeSingle(),
    supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user!.id)
      .eq("track_id", s.track_id)
      .neq("source_id", id)
      .order("started_at", { ascending: false })
      .limit(5),
  ]);

  const pb = pbRes.data as PersonalBest | null;
  const trackSessions = (trackSessionsRes.data ?? []) as Session[];
  const pbDelta = pb && s.best_lap_ms ? s.best_lap_ms - pb.time_ms : null;

  // ─── lap analytics ──────────────────────────────────────────────────────────

  const validLaps = laps.filter((l) => l.cuts === 0 && l.time_ms > 0);
  const lapTimes = validLaps.map((l) => l.time_ms);

  const bestLapMs = lapTimes.length > 0 ? Math.min(...lapTimes) : s.best_lap_ms;

  const s1Times = validLaps.map((l) => l.s1_ms).filter((v): v is number => v !== null && v > 0);
  const s2Times = validLaps.map((l) => l.s2_ms).filter((v): v is number => v !== null && v > 0);
  const s3Times = validLaps.map((l) => l.s3_ms).filter((v): v is number => v !== null && v > 0);

  const bestS1 = s1Times.length > 0 ? Math.min(...s1Times) : null;
  const bestS2 = s2Times.length > 0 ? Math.min(...s2Times) : null;
  const bestS3 = s3Times.length > 0 ? Math.min(...s3Times) : null;
  const theoreticalBest =
    bestS1 !== null && bestS2 !== null && bestS3 !== null ? bestS1 + bestS2 + bestS3 : null;

  const consistency = lapTimes.length >= 2 ? stdDev(lapTimes) : null;

  const validCuts = laps.filter((l) => l.cuts > 0).length;

  // sector percentiles for colour classification
  const s1Sorted = [...s1Times].sort((a, b) => a - b);
  const s2Sorted = [...s2Times].sort((a, b) => a - b);
  const s3Sorted = [...s3Times].sort((a, b) => a - b);

  const s1P25 = percentile(s1Sorted, 25);
  const s1P75 = percentile(s1Sorted, 75);
  const s2P25 = percentile(s2Sorted, 25);
  const s2P75 = percentile(s2Sorted, 75);
  const s3P25 = percentile(s3Sorted, 25);
  const s3P75 = percentile(s3Sorted, 75);

  const hasLapData = laps.length > 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumb */}
      <Link
        href="/sessions"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        All Sessions
      </Link>

      {/* Session header */}
      <div className="bg-card border border-border rounded-md p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            {s.session_types && (
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide mb-2 ${sessionBadgeClass(s.session_types)}`}
              >
                {s.session_types}
              </span>
            )}
            <h1 className="text-2xl font-bold text-foreground">{slugToName(s.track_id)}</h1>
            <p className="text-muted-foreground mt-0.5">{slugToName(s.car_id)}</p>
            <p className="text-xs text-muted-foreground mt-2">{formatDate(s.started_at)}</p>
          </div>
          {pb && s.best_lap_ms && (
            <div className="text-right shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                vs PB
              </p>
              <p
                className={`text-xl font-bold font-mono ${
                  pbDelta !== null && pbDelta <= 0 ? "text-green-500" : "text-destructive"
                }`}
              >
                {pbDelta !== null ? formatDeltaMs(pbDelta) : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">PB: {formatLapTime(pb.time_ms)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Laps", value: String(s.laps) },
          { label: "Valid Laps", value: validLaps.length > 0 ? `${validLaps.length} / ${laps.length}` : String(s.laps) },
          { label: "Distance", value: formatDistance(s.distance_km) },
          { label: "Best Lap", value: formatLapTime(bestLapMs), hero: true },
          { label: "Last Lap", value: formatLapTime(s.last_lap_ms) },
          {
            label: "Theoretical Best",
            value: formatLapTime(theoreticalBest),
            sub: theoreticalBest && bestLapMs
              ? `gap: ${formatDeltaMs(theoreticalBest - bestLapMs)}`
              : undefined,
          },
          {
            label: "Consistency (σ)",
            value: consistency !== null ? `${(consistency / 1000).toFixed(3)}s` : "—",
            sub: consistency !== null
              ? consistency < 500 ? "Excelente" : consistency < 1500 ? "Consistente" : "Variável"
              : undefined,
          },
          {
            label: "Laps c/ corte",
            value: hasLapData ? String(validCuts) : "—",
            sub: hasLapData && validCuts > 0 ? "não contam no PB" : undefined,
          },
        ].map(({ label, value, hero, sub }) => (
          <div key={label} className="bg-card border border-border rounded-md p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              {label}
            </p>
            <p className={`font-bold text-foreground leading-tight ${hero ? "text-2xl font-mono" : "text-xl"}`}>
              {value}
            </p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Lap table */}
      {hasLapData ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Voltas
          </p>

          {/* Sector legend */}
          <div className="flex gap-4 mb-3 flex-wrap">
            {(
              [
                ["purple", "Melhor da sessão"],
                ["green", "Top 25%"],
                ["yellow", "Top 50%"],
                ["red", "Pior quartil"],
                ["grey", "Corte / s/ dados"],
              ] as [SectorColor, string][]
            ).map(([color, label]) => (
              <span key={color} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={`inline-block w-2 h-2 rounded-full ${getSectorDotClass(color)}`} />
                {label}
              </span>
            ))}
          </div>

          <div className="bg-card border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border">
                  {[
                    { label: "#", right: false },
                    { label: "S1", right: true },
                    { label: "S2", right: true },
                    { label: "S3", right: true },
                    { label: "Total", right: true },
                    { label: "Gap", right: true },
                    { label: "Pneu", right: true },
                    { label: "Cortes", right: true },
                  ].map(({ label, right }) => (
                    <th
                      key={label}
                      className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${
                        right ? "text-right" : "text-left"
                      }`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {laps.map((lap) => {
                  const hascuts = lap.cuts > 0;
                  const isBestLap = !hascuts && lap.time_ms === bestLapMs;
                  const gap = bestLapMs !== null && !hascuts ? lap.time_ms - bestLapMs : null;

                  const s1Color = classifySector(lap.s1_ms, bestS1, s1P25, s1P75, hascuts);
                  const s2Color = classifySector(lap.s2_ms, bestS2, s2P25, s2P75, hascuts);
                  const s3Color = classifySector(lap.s3_ms, bestS3, s3P25, s3P75, hascuts);

                  return (
                    <tr
                      key={lap.id}
                      className={`border-b border-border last:border-0 transition-colors ${
                        isBestLap ? "bg-primary/5" : "hover:bg-muted/40"
                      }`}
                    >
                      <td className="px-3 py-2 text-muted-foreground text-xs">
                        <span className={isBestLap ? "text-primary font-semibold" : ""}>
                          {lap.lap_number + 1}
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-right font-mono text-xs ${getSectorColorClass(s1Color)}`}>
                        {formatSectorTime(lap.s1_ms)}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono text-xs ${getSectorColorClass(s2Color)}`}>
                        {formatSectorTime(lap.s2_ms)}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono text-xs ${getSectorColorClass(s3Color)}`}>
                        {formatSectorTime(lap.s3_ms)}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono text-xs font-semibold ${
                        hascuts ? "text-muted-foreground line-through" : isBestLap ? "text-primary" : "text-foreground"
                      }`}>
                        {formatLapTime(lap.time_ms)}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono text-xs ${
                        hascuts
                          ? "text-muted-foreground"
                          : gap === 0
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}>
                        {hascuts ? "corte" : gap === null ? "—" : gap === 0 ? "REF" : formatDeltaMs(gap)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground font-mono">
                        {lap.tyre ?? "—"}
                      </td>
                      <td className={`px-3 py-2 text-right text-xs ${
                        lap.cuts > 0 ? "text-red-400 font-semibold" : "text-muted-foreground"
                      }`}>
                        {lap.cuts}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Theoretical best breakdown */}
          {theoreticalBest !== null && (
            <div className="mt-3 bg-card border border-border rounded-md px-4 py-3 flex flex-wrap gap-6 items-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Volta Teórica
                </p>
                <p className="font-mono font-bold text-foreground mt-0.5">
                  {formatLapTime(theoreticalBest)}
                </p>
              </div>
              <div className="flex gap-4 text-xs font-mono text-muted-foreground">
                <span>
                  <span className="text-purple-400">S1</span> {formatSectorTime(bestS1)}
                </span>
                <span>+</span>
                <span>
                  <span className="text-purple-400">S2</span> {formatSectorTime(bestS2)}
                </span>
                <span>+</span>
                <span>
                  <span className="text-purple-400">S3</span> {formatSectorTime(bestS3)}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-md p-6 text-center">
          <p className="text-muted-foreground text-sm">
            Dados de volta não disponíveis para esta sessão.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Faça uma nova sincronização pelo agente para importar o detalhamento de voltas.
          </p>
        </div>
      )}

      {/* Other sessions at this track */}
      {trackSessions.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Outras sessões em {slugToName(s.track_id)}
          </p>
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Data", "Carro", "Tipo", "Voltas", "Melhor Volta"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${
                        i >= 3 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trackSessions.map((ts) => (
                  <tr
                    key={ts.id}
                    className="border-b border-border last:border-0 hover:bg-muted transition-colors"
                  >
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatDate(ts.started_at)}</td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/sessions/${ts.source_id}`}
                        className="text-foreground hover:text-primary transition-colors font-medium text-xs"
                      >
                        {slugToName(ts.car_id)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{ts.session_types ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{ts.laps}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground text-xs">
                      {formatLapTime(ts.best_lap_ms)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="flex gap-4 text-xs">
        <Link
          href={`/sessions?track=${s.track_id}`}
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          Todas as sessões em {slugToName(s.track_id)} →
        </Link>
        <Link
          href={`/sessions?car=${s.car_id}`}
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          Todas as sessões com {slugToName(s.car_id)} →
        </Link>
      </div>
    </div>
  );
}

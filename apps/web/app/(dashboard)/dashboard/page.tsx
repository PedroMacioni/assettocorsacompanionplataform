import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { LapTime } from "@/components/LapTime";
import { formatLapTime, formatDistance, slugToName } from "@/lib/format";
import type { ProfileSummary, Session, PersonalBest, AgentStatus } from "@/lib/types";
import Link from "next/link";
import { PaceChartClient } from "@/components/charts/PaceChartClient";
import { SyncButton } from "@/components/dashboard/SyncButton";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function formatDeltaMs(ms: number): string {
  const sign = ms < 0 ? "" : "+";
  return `${sign}${(ms / 1000).toFixed(3)}s`;
}

function buildPaceData(
  sessions: { started_at: string; best_lap_ms: number; track_id: string }[],
  topTracks: string[]
) {
  const dateMap = new Map<string, Record<string, number>>();
  sessions
    .filter((s) => topTracks.includes(s.track_id))
    .forEach((s) => {
      const d = new Date(s.started_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (!dateMap.has(d)) dateMap.set(d, {});
      const entry = dateMap.get(d)!;
      if (!entry[s.track_id] || s.best_lap_ms < entry[s.track_id]) {
        entry[s.track_id] = s.best_lap_ms;
      }
    });
  return Array.from(dateMap.entries()).map(([date, tracks]) => ({ date, ...tracks }));
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const fourWeeksAgo = new Date(Date.now() - 28 * 86400000);

  const [summaryRes, sessionsWeekRes, lastSessionRes, paceDataRes, pbsRes, agentStatusRes] = await Promise.all([
    supabase.from("profile_summary").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("sessions").select("laps").eq("user_id", uid).gte("started_at", weekStart.toISOString()),
    supabase.from("sessions").select("*").eq("user_id", uid).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("sessions")
      .select("started_at, best_lap_ms, track_id")
      .eq("user_id", uid)
      .not("best_lap_ms", "is", null)
      .gte("started_at", fourWeeksAgo.toISOString())
      .order("started_at", { ascending: true }),
    supabase.from("personal_bests").select("*").eq("user_id", uid).order("time_ms", { ascending: true }).limit(5),
    supabase.from("agent_status").select("*").eq("user_id", uid).maybeSingle(),
  ]);

  const summary = summaryRes.data as ProfileSummary | null;
  if (!summary || summary.total_sessions === 0) return <EmptyState />;

  const sessionsWeek = (sessionsWeekRes.data ?? []) as { laps: number }[];
  const lastSession = lastSessionRes.data as Session | null;
  const paceRaw = (paceDataRes.data ?? []) as { started_at: string; best_lap_ms: number; track_id: string }[];
  const personalBests = (pbsRes.data ?? []) as PersonalBest[];
  const agentStatus = agentStatusRes.data as AgentStatus | null;

  // Week stats
  const weekLaps = sessionsWeek.reduce((sum, s) => sum + (s.laps ?? 0), 0);
  const weekSessions = sessionsWeek.length;

  // Last session: PB + improvement vs previous
  let lastPb: PersonalBest | null = null;
  let improvement: { delta_ms: number } | null = null;

  if (lastSession) {
    const [pbRes, prevRes] = await Promise.all([
      supabase
        .from("personal_bests")
        .select("*")
        .eq("user_id", uid)
        .eq("car_id", lastSession.car_id)
        .eq("track_id", lastSession.track_id)
        .maybeSingle(),
      lastSession.best_lap_ms
        ? supabase
            .from("sessions")
            .select("best_lap_ms")
            .eq("user_id", uid)
            .eq("car_id", lastSession.car_id)
            .eq("track_id", lastSession.track_id)
            .not("best_lap_ms", "is", null)
            .lt("started_at", lastSession.started_at)
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve(null),
    ]);
    lastPb = pbRes.data as PersonalBest | null;
    const prev = prevRes as { data: { best_lap_ms: number } | null } | null;
    if (prev?.data?.best_lap_ms && lastSession.best_lap_ms) {
      improvement = { delta_ms: lastSession.best_lap_ms - prev.data.best_lap_ms };
    }
  }

  // Pace chart data
  const trackCount: Record<string, number> = {};
  paceRaw.forEach((s) => {
    trackCount[s.track_id] = (trackCount[s.track_id] ?? 0) + 1;
  });
  const topTracks = Object.entries(trackCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map((e) => e[0]);
  const paceData = buildPaceData(paceRaw, topTracks);
  const trackLabels = Object.fromEntries(topTracks.map((t) => [t, slugToName(t)]));

  // Header
  const now = new Date();
  const dayLabel = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const dateLabel = now.toLocaleDateString("en-US", { day: "numeric", month: "long" }).toUpperCase();
  const displayName =
    user!.user_metadata?.display_name ?? user!.email?.split("@")[0] ?? "Driver";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-1">
            {dayLabel} · {dateLabel}
          </p>
          <h1 className="text-2xl font-bold text-white">
            {getGreeting()}, {displayName}.
          </h1>
        </div>

        {/* Agent sync status */}
        <div className="shrink-0 flex items-center gap-3 mt-1">
          {agentStatus?.last_synced_at ? (
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72]">
                  Agente online
                </span>
              </div>
              <p className="text-[11px] text-[#6b6b72]">
                Último sync {timeAgo(agentStatus.last_synced_at)}
                {agentStatus.last_sync_sessions_count > 0 && (
                  <span className="text-[#e8612a]">
                    {" "}· {agentStatus.last_sync_sessions_count} sessão{agentStatus.last_sync_sessions_count !== 1 ? "ões" : ""}
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6b6b72]" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72]">
                  Agente não visto
                </span>
              </div>
              <p className="text-[11px] text-[#6b6b72]">
                {lastSession ? `Última sessão ${timeAgo(lastSession.started_at)}` : "Nenhum sync registrado"}
              </p>
            </div>
          )}
          <SyncButton userId={uid} />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Laps this week" value={weekLaps.toLocaleString()} />
        <KpiCard label="Sessions this week" value={weekSessions.toLocaleString()} />
        <KpiCard
          label="Best lap δ"
          value={improvement ? formatDeltaMs(improvement.delta_ms) : "—"}
          sub={
            improvement && lastSession
              ? slugToName(lastSession.track_id)
              : "No comparison yet"
          }
          subVariant={
            improvement
              ? improvement.delta_ms < 0
                ? "positive"
                : "negative"
              : "neutral"
          }
        />
        <KpiCard
          label="Total sessions"
          value={summary.total_sessions.toLocaleString()}
          sub={`${summary.unique_tracks} tracks · ${summary.unique_cars} cars`}
        />
      </div>

      {/* Last session + driver stats */}
      <div className="grid grid-cols-3 gap-4">
        {/* Last session card */}
        {lastSession ? (
          <div className="col-span-2 bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-3">
              Last Session
            </p>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">
                  {slugToName(lastSession.track_id)}
                </h3>
                <p className="text-sm text-[#6b6b72] mt-0.5">{slugToName(lastSession.car_id)}</p>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-[#6b6b72] mt-2">
                  <span>{lastSession.laps} laps</span>
                  {lastSession.session_types && (
                    <>
                      <span>·</span>
                      <span>{lastSession.session_types}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>{timeAgo(lastSession.started_at)}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-1">
                  Best Lap
                </p>
                <p className="text-2xl font-bold text-white font-mono">
                  {formatLapTime(lastSession.best_lap_ms)}
                </p>
                {lastPb && lastSession.best_lap_ms && (() => {
                  const delta = lastSession.best_lap_ms - lastPb.time_ms;
                  return (
                    <p
                      className={`text-sm font-medium mt-1 ${
                        delta <= 0 ? "text-[#22c55e]" : "text-[#ef4444]"
                      }`}
                    >
                      {formatDeltaMs(delta)} vs PB
                    </p>
                  );
                })()}
              </div>
            </div>
            {/* Progress bar vs PB */}
            {lastPb && lastSession.best_lap_ms && (
              <div className="mt-4">
                <div className="flex justify-between text-[10px] text-[#6b6b72] mb-1.5 uppercase tracking-wider">
                  <span>vs Personal Best</span>
                  <span>{formatLapTime(lastPb.time_ms)}</span>
                </div>
                <div className="h-1.5 bg-[#1e1e20] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      lastSession.best_lap_ms <= lastPb.time_ms
                        ? "bg-[#22c55e]"
                        : "bg-[#e8612a]"
                    }`}
                    style={{
                      width: `${Math.min(100, (lastPb.time_ms / lastSession.best_lap_ms) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="col-span-2 bg-[#161618] border border-[#2a2a2c] rounded-md p-5 flex items-center justify-center min-h-[140px]">
            <p className="text-[#6b6b72] text-sm">No sessions yet</p>
          </div>
        )}

        {/* Driver stats */}
        <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-4">
            Driver Stats
          </p>
          <div className="space-y-3.5">
            {[
              { label: "Total Laps", value: summary.total_laps.toLocaleString() },
              { label: "Distance", value: formatDistance(summary.total_distance_km) },
              {
                label: "Fastest Lap",
                value: formatLapTime(summary.fastest_lap_ms),
                mono: true,
              },
              { label: "Cars", value: String(summary.unique_cars) },
              { label: "Tracks", value: String(summary.unique_tracks) },
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72]">
                  {label}
                </span>
                <span className={`text-sm font-bold text-white ${mono ? "font-mono" : ""}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pace evolution + personal records */}
      <div className="grid grid-cols-3 gap-4">
        {/* Pace evolution */}
        <div className="col-span-2 bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-1">
                Pace Evolution
              </p>
              <p className="text-sm text-white font-medium">Best lap time — last 4 weeks</p>
            </div>
            <Link
              href="/analytics?tab=pace"
              className="text-[10px] text-[#6b6b72] hover:text-[#e8612a] uppercase tracking-wider transition-colors"
            >
              Full view →
            </Link>
          </div>
          <PaceChartClient data={paceData} tracks={topTracks} trackLabels={trackLabels} />
        </div>

        {/* Personal records */}
        <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-4">
            Personal Records
          </p>
          {personalBests.length > 0 ? (
            <div className="space-y-3">
              {personalBests.map((pb, i) => (
                <div key={pb.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-white font-medium truncate">
                      {slugToName(pb.car_id)}
                    </p>
                    <p className="text-[10px] text-[#6b6b72] truncate">
                      {slugToName(pb.track_id)}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-bold font-mono shrink-0 ${
                      i === 0 ? "text-[#e8612a]" : "text-white"
                    }`}
                  >
                    {formatLapTime(pb.time_ms)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#6b6b72] text-sm">No records yet</p>
          )}
          <Link
            href="/analytics?tab=records"
            className="mt-4 block text-[10px] text-[#6b6b72] hover:text-[#e8612a] uppercase tracking-wider transition-colors"
          >
            View all →
          </Link>
        </div>
      </div>
    </div>
  );
}

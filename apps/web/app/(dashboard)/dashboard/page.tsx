import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { HeroCard } from "@/components/dashboard/HeroCard";
import { LastSessionCard } from "@/components/dashboard/LastSessionCard";
import { ActivityCalendar } from "@/components/dashboard/ActivityCalendar";
import { QuickStatsBar } from "@/components/dashboard/QuickStatsBar";
import { TopRecordsCard } from "@/components/dashboard/TopRecordsCard";
import { QuickNavCards } from "@/components/dashboard/QuickNavCards";
import { SyncButton } from "@/components/dashboard/SyncButton";
import { PaceChartWithSelector } from "@/components/charts/PaceChartWithSelector";
import {
  calculateStreak,
  getSessionDates,
  calculateConsistencyScore,
  getSessionQualityBadge,
  calculateAvgLapTime,
  calculateStdDev,
} from "@/lib/calculations";
import { slugToName } from "@/lib/format";
import type { ProfileSummary, Session, PersonalBest, AgentStatus } from "@/lib/types";
import Link from "next/link";
import { Wifi, WifiOff, ExternalLink } from "lucide-react";

function getGreetingKey(): "goodMorning" | "goodAfternoon" | "goodEvening" {
  const h = new Date().getHours();
  if (h < 12) return "goodMorning";
  if (h < 18) return "goodAfternoon";
  return "goodEvening";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d atrás`;
  if (hrs > 0) return `${hrs}h atrás`;
  if (mins > 0) return `${mins}m atrás`;
  return "agora";
}

function buildPaceData(
  sessions: { started_at: string; best_lap_ms: number; track_id: string }[],
  topTracks: string[]
) {
  const weekMap = new Map<string, Record<string, number>>();
  sessions
    .filter((s) => topTracks.includes(s.track_id))
    .forEach((s) => {
      const d = new Date(s.started_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekKey = weekStart.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
      if (!weekMap.has(weekKey)) weekMap.set(weekKey, {});
      const entry = weekMap.get(weekKey)!;
      if (!entry[s.track_id] || s.best_lap_ms < entry[s.track_id]) {
        entry[s.track_id] = s.best_lap_ms;
      }
    });
  return Array.from(weekMap.entries()).map(([date, tracks]) => ({ date, ...tracks }));
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const tHeader = await getTranslations("Header");
  const tPace = await getTranslations("PaceChart");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const eightWeeksAgo = new Date(Date.now() - 56 * 86400000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

  // ── Batch 1: all queries that don't depend on each other ────────────────
  const [
    summaryRes,
    sessionsWeekRes,
    lastSessionRes,
    paceDataRes,
    pbsRes,
    agentStatusRes,
    allSessionDatesRes,
    lastWeekSessionsRes,
    newPbsRes,
    activityRawRes,
    recentSourcesRes,
  ] = await Promise.all([
    supabase.from("profile_summary").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("sessions").select("laps").eq("user_id", uid).gte("started_at", weekStart.toISOString()),
    supabase.from("sessions").select("*").eq("user_id", uid).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("sessions")
      .select("started_at, best_lap_ms, track_id")
      .eq("user_id", uid)
      .not("best_lap_ms", "is", null)
      .gte("started_at", eightWeeksAgo.toISOString())
      .order("started_at", { ascending: true }),
    supabase.from("personal_bests").select("*").eq("user_id", uid).order("time_ms", { ascending: true }).limit(5),
    supabase.from("agent_status").select("*").eq("user_id", uid).maybeSingle(),
    // Fase 2 — novos:
    supabase.from("sessions").select("started_at").eq("user_id", uid),
    supabase.from("sessions").select("laps").eq("user_id", uid).gte("started_at", lastWeekStart.toISOString()).lt("started_at", weekStart.toISOString()),
    supabase.from("personal_bests").select("id").eq("user_id", uid).gte("synced_at", weekStart.toISOString()),
    supabase.from("sessions").select("started_at").eq("user_id", uid).gte("started_at", ninetyDaysAgo.toISOString()),
    supabase.from("sessions").select("source_id").eq("user_id", uid).not("best_lap_ms", "is", null).order("started_at", { ascending: false }).limit(10),
  ]);

  const summary = summaryRes.data as ProfileSummary | null;
  if (!summary || summary.total_sessions === 0) return <EmptyState />;

  const sessionsWeek = (sessionsWeekRes.data ?? []) as { laps: number }[];
  const lastSession = lastSessionRes.data as Session | null;
  const paceRaw = (paceDataRes.data ?? []) as { started_at: string; best_lap_ms: number; track_id: string }[];
  const personalBests = (pbsRes.data ?? []) as PersonalBest[];
  const agentStatus = agentStatusRes.data as AgentStatus | null;

  const weekLaps = sessionsWeek.reduce((sum, s) => sum + (s.laps ?? 0), 0);
  const weekSessions = sessionsWeek.length;

  // Streak
  const allSessionDates = (allSessionDatesRes.data ?? []) as { started_at: string }[];
  const streak = calculateStreak(getSessionDates(allSessionDates));

  // Weekly delta
  const lastWeekLaps = (lastWeekSessionsRes.data ?? []).reduce(
    (sum: number, s: { laps: number }) => sum + (s.laps ?? 0),
    0
  );
  const deltaVsLastWeek =
    lastWeekLaps > 0
      ? Math.round(((weekLaps - lastWeekLaps) / lastWeekLaps) * 100)
      : weekLaps > 0
      ? 100
      : 0;

  // PBs batidos esta semana
  const pbsBeaten = (newPbsRes.data ?? []).length;

  // Activity calendar
  const activityMap = new Map<string, number>();
  (activityRawRes.data ?? []).forEach((s: { started_at: string }) => {
    const date = s.started_at.split("T")[0];
    activityMap.set(date, (activityMap.get(date) ?? 0) + 1);
  });
  const activityData = Array.from(activityMap.entries()).map(([date, count]) => ({ date, count }));

  // Source IDs para query de laps
  const recentSourceIds = (recentSourcesRes.data ?? []).map((s: { source_id: string }) => s.source_id);

  // ── Batch 2: queries que dependem de lastSession e recentSourceIds ──────
  let lastPb: PersonalBest | null = null;
  let pbDelta: number | null = null;
  let prevBestMs: number | null = null;
  let consistencyResult = { score: 0, trend: "stable" as "up" | "down" | "stable" };
  let qualityBadge = getSessionQualityBadge(
    { best_lap_ms: null, laps: 0 },
    {}
  );

  const [consistencyLapsRes, sessionLapsRes, pbRes, prevRes] = await Promise.all([
    recentSourceIds.length > 0
      ? supabase.from("laps").select("time_ms").eq("user_id", uid).in("session_source_id", recentSourceIds).eq("cuts", 0).gt("time_ms", 0).limit(40)
      : Promise.resolve({ data: [] as { time_ms: number }[] }),
    lastSession?.source_id
      ? supabase.from("laps").select("time_ms").eq("user_id", uid).eq("session_source_id", lastSession.source_id).eq("cuts", 0).gt("time_ms", 0)
      : Promise.resolve({ data: [] as { time_ms: number }[] }),
    lastSession
      ? supabase.from("personal_bests").select("*").eq("user_id", uid).eq("car_id", lastSession.car_id).eq("track_id", lastSession.track_id).maybeSingle()
      : Promise.resolve({ data: null }),
    lastSession?.best_lap_ms
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
      : Promise.resolve({ data: null }),
  ]);

  // Consistency score (últimas até 20 voltas válidas)
  const consistencyLapTimes = (consistencyLapsRes.data ?? [])
    .map((l: { time_ms: number }) => l.time_ms)
    .slice(-20);
  if (consistencyLapTimes.length >= 2) {
    const { score, trend } = calculateConsistencyScore(consistencyLapTimes);
    consistencyResult = { score, trend };
  }

  // Session quality badge com std dev real
  if (lastSession) {
    lastPb = pbRes.data as PersonalBest | null;
    const prev = prevRes as { data: { best_lap_ms: number } | null } | null;
    prevBestMs = prev?.data?.best_lap_ms ?? null;

    if (lastPb && lastSession.best_lap_ms) {
      pbDelta = lastSession.best_lap_ms - lastPb.time_ms;
    }

    const sessionLapTimes = (sessionLapsRes.data ?? []).map((l: { time_ms: number }) => l.time_ms);
    const currentSessionAvgMs = calculateAvgLapTime(sessionLapTimes);
    const currentSessionStdDev = calculateStdDev(sessionLapTimes);

    qualityBadge = getSessionQualityBadge(
      { best_lap_ms: lastSession.best_lap_ms, laps: lastSession.laps },
      {
        previousBestMs: prevBestMs,
        currentSessionAvgMs,
        currentSessionStdDev,
      }
    );
  }

  // Pace chart
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

  const displayName =
    user!.user_metadata?.display_name ?? user!.email?.split("@")[0] ?? "Driver";

  const dayLabel = now.toLocaleDateString("pt-BR", { weekday: "long" }).toUpperCase();
  const dateLabel = now.toLocaleDateString("pt-BR", { day: "numeric", month: "long" }).toUpperCase();

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 animate-in fade-in duration-500">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            {dayLabel} · {dateLabel}
          </p>
          <h1 className="text-2xl font-bold text-foreground">
            {tHeader(getGreetingKey())}, {displayName}.
          </h1>
        </div>

        <div className="shrink-0 flex items-center gap-3 sm:mt-1">
          {agentStatus?.last_synced_at ? (
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 mb-0.5">
                <Wifi className="w-3 h-3 text-green-500" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {tHeader("agentOnline")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {tHeader("lastSync", { time: timeAgo(agentStatus.last_synced_at) })}
                {agentStatus.last_sync_sessions_count > 0 && (
                  <span className="text-primary">
                    {" "}· {agentStatus.last_sync_sessions_count}{" "}
                    {agentStatus.last_sync_sessions_count !== 1 ? "sessões" : "sessão"}
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 mb-0.5">
                <WifiOff className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {tHeader("agentOffline")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {lastSession ? timeAgo(lastSession.started_at) : "Nenhum sync registrado"}
              </p>
            </div>
          )}
          <SyncButton userId={uid} />
        </div>
      </div>

      {/* [1] HERO CARD — dados reais */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
      <HeroCard
        streak={streak}
        consistency={consistencyResult}
        weeklyDigest={{
          laps: weekLaps,
          sessions: weekSessions,
          pbsBeaten,
          deltaVsLastWeek,
        }}
      />
      </div>

      {/* [2] LAST SESSION + [3] ACTIVITY CALENDAR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
        {lastSession ? (
          <LastSessionCard
            session={lastSession}
            qualityBadge={qualityBadge}
            pbTime={lastPb?.time_ms}
            pbDelta={pbDelta}
          />
        ) : (
          <div className="bg-card border border-border rounded-md p-5 flex items-center justify-center min-h-[180px]">
            <p className="text-muted-foreground text-sm">Nenhuma sessão ainda</p>
          </div>
        )}
        {/* Activity Calendar — dados reais (últimos 90 dias) */}
        <ActivityCalendar sessions={activityData} daysToShow={90} />
      </div>

      {/* [4] QUICK STATS BAR */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
      <QuickStatsBar
        tracks={summary.unique_tracks}
        cars={summary.unique_cars}
        distanceKm={summary.total_distance_km}
        laps={summary.total_laps}
      />
      </div>

      {/* [5] PACE EVOLUTION + [6] PERSONAL RECORDS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
        <div className="xl:col-span-2 bg-card border border-border rounded-md p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                {tPace("title")}
              </p>
              <p className="text-sm text-foreground font-medium">{tPace("subtitle")}</p>
            </div>
            <Link
              href="/analytics?tab=pace"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary uppercase tracking-wider transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {tPace("fullView")}
            </Link>
          </div>
          <PaceChartWithSelector data={paceData} tracks={topTracks} trackLabels={trackLabels} />
        </div>

        <TopRecordsCard records={personalBests} />
      </div>

      {/* [7] QUICK NAV CARDS */}
      <div className="animate-in fade-in duration-500 delay-500">
        <QuickNavCards />
      </div>
    </div>
  );
}

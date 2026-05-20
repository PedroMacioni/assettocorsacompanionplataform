import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { slugToName } from "@/lib/format";
import type { ProfileSummary, Session, PersonalBest, AgentStatus } from "@/lib/types";
import {
  HeroCard,
  ActivityCalendar,
  LastSessionCard,
  PaceEvolutionCard,
  TopRecordsCard,
  QuickStatsBar,
  QuickNavCards,
  SyncButton,
} from "@/components/dashboard";
import {
  calculateStreak,
  getSessionDates,
  calculateConsistencyScore,
  getSessionQualityBadge,
} from "@/lib/calculations";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
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
  const dateMap = new Map<string, Record<string, number>>();
  sessions
    .filter((s) => topTracks.includes(s.track_id))
    .forEach((s) => {
      const d = new Date(s.started_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
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

  // Date ranges
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
  const fourWeeksAgo = new Date(Date.now() - 28 * 86400000);

  // Parallel queries
  const [
    summaryRes,
    allSessionsRes,
    sessionsWeekRes,
    sessionsLastWeekRes,
    lastSessionRes,
    paceDataRes,
    pbsRes,
    agentStatusRes,
    recentLapsRes,
    pbsThisWeekRes,
  ] = await Promise.all([
    supabase.from("profile_summary").select("*").eq("user_id", uid).maybeSingle(),
    supabase
      .from("sessions")
      .select("started_at")
      .eq("user_id", uid)
      .gte("started_at", ninetyDaysAgo.toISOString())
      .order("started_at", { ascending: false }),
    supabase
      .from("sessions")
      .select("laps")
      .eq("user_id", uid)
      .gte("started_at", weekStart.toISOString()),
    supabase
      .from("sessions")
      .select("laps")
      .eq("user_id", uid)
      .gte("started_at", lastWeekStart.toISOString())
      .lt("started_at", weekStart.toISOString()),
    supabase
      .from("sessions")
      .select("*")
      .eq("user_id", uid)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sessions")
      .select("started_at, best_lap_ms, track_id")
      .eq("user_id", uid)
      .not("best_lap_ms", "is", null)
      .gte("started_at", fourWeeksAgo.toISOString())
      .order("started_at", { ascending: true }),
    supabase
      .from("personal_bests")
      .select("*")
      .eq("user_id", uid)
      .order("time_ms", { ascending: true })
      .limit(5),
    supabase.from("agent_status").select("*").eq("user_id", uid).maybeSingle(),
    supabase
      .from("sessions")
      .select("best_lap_ms")
      .eq("user_id", uid)
      .not("best_lap_ms", "is", null)
      .order("started_at", { ascending: false })
      .limit(20),
    supabase
      .from("personal_bests")
      .select("id")
      .eq("user_id", uid)
      .gte("source_date", Math.floor(weekStart.getTime() / 1000)),
  ]);

  const summary = summaryRes.data as ProfileSummary | null;
  if (!summary || summary.total_sessions === 0) return <EmptyState />;

  const allSessions = (allSessionsRes.data ?? []) as { started_at: string }[];
  const sessionsWeek = (sessionsWeekRes.data ?? []) as { laps: number }[];
  const sessionsLastWeek = (sessionsLastWeekRes.data ?? []) as { laps: number }[];
  const lastSession = lastSessionRes.data as Session | null;
  const paceRaw = (paceDataRes.data ?? []) as { started_at: string; best_lap_ms: number; track_id: string }[];
  const personalBests = (pbsRes.data ?? []) as PersonalBest[];
  const agentStatus = agentStatusRes.data as AgentStatus | null;
  const recentLaps = (recentLapsRes.data ?? []) as { best_lap_ms: number }[];
  const pbsThisWeek = (pbsThisWeekRes.data ?? []) as { id: string }[];

  // Calculate streak
  const sessionDates = getSessionDates(allSessions);
  const streak = calculateStreak(sessionDates);

  // Calculate consistency score
  const lapTimes = recentLaps.map((l) => l.best_lap_ms).filter((t) => t > 0);
  const consistency = calculateConsistencyScore(lapTimes);

  // Weekly digest
  const weekLaps = sessionsWeek.reduce((sum, s) => sum + (s.laps ?? 0), 0);
  const weekSessions = sessionsWeek.length;
  const lastWeekLaps = sessionsLastWeek.reduce((sum, s) => sum + (s.laps ?? 0), 0);
  const deltaVsLastWeek =
    lastWeekLaps > 0 ? ((weekLaps - lastWeekLaps) / lastWeekLaps) * 100 : 0;

  // Activity calendar data
  const activityMap = new Map<string, number>();
  allSessions.forEach((s) => {
    const date = s.started_at.split("T")[0];
    activityMap.set(date, (activityMap.get(date) ?? 0) + 1);
  });
  const activityData = Array.from(activityMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  // Last session quality badge
  let lastSessionBadge = getSessionQualityBadge(
    { best_lap_ms: null, laps: 0 },
    {}
  );
  let lastPb: PersonalBest | null = null;
  let pbDelta: number | null = null;

  if (lastSession) {
    const [pbRes, prevBestRes] = await Promise.all([
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
            .order("best_lap_ms", { ascending: true })
            .limit(1)
            .maybeSingle()
        : Promise.resolve(null),
    ]);

    lastPb = pbRes.data as PersonalBest | null;
    const prevBest = prevBestRes as { data: { best_lap_ms: number } | null } | null;

    if (lastPb && lastSession.best_lap_ms) {
      pbDelta = lastSession.best_lap_ms - lastPb.time_ms;
    }

    lastSessionBadge = getSessionQualityBadge(
      { best_lap_ms: lastSession.best_lap_ms, laps: lastSession.laps },
      {
        previousBestMs: prevBest?.data?.best_lap_ms ?? lastPb?.time_ms,
      }
    );
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

  // Header info
  const dayLabel = now
    .toLocaleDateString("pt-BR", { weekday: "long" })
    .toUpperCase();
  const dateLabel = now
    .toLocaleDateString("pt-BR", { day: "numeric", month: "long" })
    .toUpperCase();
  const displayName =
    user!.user_metadata?.display_name ?? user!.email?.split("@")[0] ?? "Piloto";

  return (
    <div className="space-y-8">
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
                  Online
                </span>
              </div>
              <p className="text-[11px] text-[#6b6b72]">
                Sync {timeAgo(agentStatus.last_synced_at)}
              </p>
            </div>
          ) : (
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6b6b72]" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72]">
                  Offline
                </span>
              </div>
              <p className="text-[11px] text-[#6b6b72]">Agent não conectado</p>
            </div>
          )}
          <SyncButton userId={uid} />
        </div>
      </div>

      {/* Hero Card */}
      <HeroCard
        streak={streak}
        consistency={{ score: consistency.score, trend: consistency.trend }}
        weeklyDigest={{
          laps: weekLaps,
          sessions: weekSessions,
          pbsBeaten: pbsThisWeek.length,
          deltaVsLastWeek,
        }}
      />

      {/* Activity Calendar + Last Session */}
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3">
          <ActivityCalendar sessions={activityData} daysToShow={90} />
        </div>
        <div className="col-span-2">
          {lastSession ? (
            <LastSessionCard
              session={lastSession}
              qualityBadge={lastSessionBadge}
              pbTime={lastPb?.time_ms}
              pbDelta={pbDelta}
            />
          ) : (
            <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5 h-full flex items-center justify-center">
              <p className="text-sm text-[#6b6b72]">Nenhuma sessão ainda</p>
            </div>
          )}
        </div>
      </div>

      {/* Pace Evolution + Top Records */}
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3">
          <PaceEvolutionCard
            data={paceData}
            tracks={topTracks}
            trackLabels={trackLabels}
          />
        </div>
        <div className="col-span-2">
          <TopRecordsCard records={personalBests} />
        </div>
      </div>

      {/* Quick Stats Bar */}
      <QuickStatsBar
        tracks={summary.unique_tracks}
        cars={summary.unique_cars}
        distanceKm={summary.total_distance_km}
        laps={summary.total_laps}
      />

      {/* Quick Navigation */}
      <QuickNavCards />
    </div>
  );
}

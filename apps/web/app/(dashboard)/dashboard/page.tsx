import { Suspense } from "react";
import { getTranslations, getLocale } from "next-intl/server";
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
import {
  getProfileSummary,
  getPersonalBests,
  getAgentStatus,
  getAllSessionDates,
  getLastSession,
  getSessionsForPaceChart,
  getSessionsForCalendar,
  getSessionsWithLaps,
  getRecentSessionSourceIds,
  getNewPersonalBests,
  getLapTimesForConsistency,
  getSessionLapTimes,
  getPersonalBestForCombo,
  getPreviousBestLap,
} from "@/lib/queries";
import Link from "next/link";
import { Wifi, WifiOff, ExternalLink } from "lucide-react";

function getGreetingKey(): "goodMorning" | "goodAfternoon" | "goodEvening" {
  const h = new Date().getHours();
  if (h < 12) return "goodMorning";
  if (h < 18) return "goodAfternoon";
  return "goodEvening";
}

function buildPaceData(
  sessions: { started_at: string; best_lap_ms: number; track_id: string }[],
  topTracks: string[],
  locale: string
) {
  const weekMap = new Map<string, Record<string, number>>();
  sessions
    .filter((s) => topTracks.includes(s.track_id))
    .forEach((s) => {
      const d = new Date(s.started_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekKey = weekStart.toLocaleDateString(locale, { day: "numeric", month: "short" });
      if (!weekMap.has(weekKey)) weekMap.set(weekKey, {});
      const entry = weekMap.get(weekKey)!;
      if (!entry[s.track_id] || s.best_lap_ms < entry[s.track_id]) {
        entry[s.track_id] = s.best_lap_ms;
      }
    });
  return Array.from(weekMap.entries()).map(([date, tracks]) => ({ date, ...tracks }));
}

// Loading skeleton for dashboard sections
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-1/3" />
      <div className="h-40 bg-muted rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-48 bg-muted rounded" />
        <div className="h-48 bg-muted rounded" />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent userId={uid} userEmail={user!.email} userDisplayName={user!.user_metadata?.display_name} />
    </Suspense>
  );
}

async function DashboardContent({
  userId,
  userEmail,
  userDisplayName,
}: {
  userId: string;
  userEmail?: string | null;
  userDisplayName?: string;
}) {
  const tHeader = await getTranslations("Header");
  const tPace = await getTranslations("PaceChart");
  const tCommon = await getTranslations("Common");
  const tDash = await getTranslations("Dashboard");
  const locale = await getLocale();

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return tCommon("timeAgo.daysAgo", { count: days });
    if (hrs > 0) return tCommon("timeAgo.hoursAgo", { count: hrs });
    if (mins > 0) return tCommon("timeAgo.minutesAgo", { count: mins });
    return tCommon("timeAgo.now");
  }

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const eightWeeksAgo = new Date(Date.now() - 56 * 86400000);

  // ── Batch 1: All cached queries in parallel ────────────────────────────────
  const [
    summary,
    sessionsWeek,
    lastSession,
    paceRaw,
    personalBests,
    agentStatus,
    allSessionDates,
    lastWeekSessions,
    newPbs,
    activityRaw,
    recentSourceIds,
  ] = await Promise.all([
    getProfileSummary(userId),
    getSessionsWithLaps(userId, weekStart),
    getLastSession(userId),
    getSessionsForPaceChart(userId, eightWeeksAgo),
    getPersonalBests(userId, 5),
    getAgentStatus(userId),
    getAllSessionDates(userId),
    getSessionsWithLaps(userId, lastWeekStart, weekStart),
    getNewPersonalBests(userId, weekStart),
    getSessionsForCalendar(userId, 90),
    getRecentSessionSourceIds(userId, 10),
  ]);

  if (!summary || summary.total_sessions === 0) return <EmptyState />;

  const weekLaps = sessionsWeek.reduce((sum, s) => sum + (s.laps ?? 0), 0);
  const weekSessions = sessionsWeek.length;

  // Streak
  const streak = calculateStreak(getSessionDates(allSessionDates));

  // Weekly delta
  const lastWeekLaps = lastWeekSessions.reduce((sum, s) => sum + (s.laps ?? 0), 0);
  const deltaVsLastWeek =
    lastWeekLaps > 0
      ? Math.round(((weekLaps - lastWeekLaps) / lastWeekLaps) * 100)
      : weekLaps > 0
      ? 100
      : 0;

  // PBs batidos esta semana
  const pbsBeaten = newPbs.length;

  // Activity calendar
  const activityMap = new Map<string, number>();
  activityRaw.forEach((s) => {
    const date = s.started_at.split("T")[0];
    activityMap.set(date, (activityMap.get(date) ?? 0) + 1);
  });
  const activityData = Array.from(activityMap.entries()).map(([date, count]) => ({ date, count }));

  // ── Batch 2: Queries that depend on lastSession and recentSourceIds ────────
  let lastPb = null;
  let pbDelta: number | null = null;
  let prevBestMs: number | null = null;
  let consistencyResult = { score: 0, trend: "stable" as "up" | "down" | "stable" };
  let qualityBadge = getSessionQualityBadge({ best_lap_ms: null, laps: 0 }, {});

  const [consistencyLaps, sessionLaps, pbData, prevBest] = await Promise.all([
    recentSourceIds.length > 0
      ? getLapTimesForConsistency(userId, recentSourceIds, 40)
      : Promise.resolve([]),
    lastSession?.source_id
      ? getSessionLapTimes(userId, lastSession.source_id)
      : Promise.resolve([]),
    lastSession
      ? getPersonalBestForCombo(userId, lastSession.car_id, lastSession.track_id)
      : Promise.resolve(null),
    lastSession?.best_lap_ms
      ? getPreviousBestLap(userId, lastSession.car_id, lastSession.track_id, lastSession.started_at)
      : Promise.resolve(null),
  ]);

  // Consistency score (últimas até 20 voltas válidas)
  const consistencyLapTimes = consistencyLaps.map((l) => l.time_ms).slice(-20);
  if (consistencyLapTimes.length >= 2) {
    const { score, trend } = calculateConsistencyScore(consistencyLapTimes);
    consistencyResult = { score, trend };
  }

  // Session quality badge com std dev real
  if (lastSession) {
    lastPb = pbData;
    prevBestMs = prevBest;

    if (lastPb && lastSession.best_lap_ms) {
      pbDelta = lastSession.best_lap_ms - lastPb.time_ms;
    }

    const sessionLapTimes = sessionLaps.map((l) => l.time_ms);
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
  const paceData = buildPaceData(paceRaw, topTracks, locale);
  const trackLabels = Object.fromEntries(topTracks.map((t) => [t, slugToName(t)]));

  const displayName = userDisplayName ?? userEmail?.split("@")[0] ?? "Driver";

  const dayLabel = now.toLocaleDateString(locale, { weekday: "long" }).toUpperCase();
  const dateLabel = now.toLocaleDateString(locale, { day: "numeric", month: "long" }).toUpperCase();

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
                    {" "}· {tDash("sessionsCount", { count: agentStatus.last_sync_sessions_count })}
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
                {lastSession ? timeAgo(lastSession.started_at) : tDash("noSyncRegistered")}
              </p>
            </div>
          )}
          <SyncButton userId={userId} />
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
            <p className="text-muted-foreground text-sm">{tDash("noSession")}</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
        <div className="lg:col-span-2 bg-card border border-border rounded-md p-5">
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

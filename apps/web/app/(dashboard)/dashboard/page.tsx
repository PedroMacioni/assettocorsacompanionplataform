import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { LastSessionCard } from "@/components/dashboard/LastSessionCard";
import { ActivityCalendar } from "@/components/dashboard/ActivityCalendar";
import { QuickStatsBar } from "@/components/dashboard/QuickStatsBar";
import { RecentRecordsCard } from "@/components/dashboard/RecentRecordsCard";
import { ComboProgressCard } from "@/components/dashboard/ComboProgressCard";
import { QuickNavCards } from "@/components/dashboard/QuickNavCards";
import { SyncButton } from "@/components/dashboard/SyncButton";
import {
  getSessionQualityBadge,
  calculateAvgLapTime,
  calculateStdDev,
} from "@/lib/calculations";
import type { ProfileSummary, Session, PersonalBest, AgentStatus } from "@/lib/types";
import type { ComboData } from "@/components/dashboard/ComboProgressCard";
import { Wifi, WifiOff } from "lucide-react";

function getGreetingKey(): "goodMorning" | "goodAfternoon" | "goodEvening" {
  const h = new Date().getHours();
  if (h < 12) return "goodMorning";
  if (h < 18) return "goodAfternoon";
  return "goodEvening";
}

function buildCombosData(
  sessions: { started_at: string; best_lap_ms: number; car_id: string; track_id: string }[],
  locale: string,
  defaultCar?: string,
  defaultTrack?: string
): { combos: ComboData[]; initialIndex: number } {
  const countMap = new Map<string, { car_id: string; track_id: string; count: number }>();
  sessions.forEach((s) => {
    const key = `${s.car_id}||${s.track_id}`;
    if (!countMap.has(key)) countMap.set(key, { car_id: s.car_id, track_id: s.track_id, count: 0 });
    countMap.get(key)!.count++;
  });

  const topCombos = [...countMap.values()]
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  if (topCombos.length === 0) return { combos: [], initialIndex: 0 };

  const combos: ComboData[] = topCombos.map((combo) => ({
    car_id: combo.car_id,
    track_id: combo.track_id,
    sessions: sessions
      .filter((s) => s.car_id === combo.car_id && s.track_id === combo.track_id)
      .map((s) => ({
        date: new Date(s.started_at).toLocaleDateString(locale, { day: "numeric", month: "short" }),
        best_lap_ms: s.best_lap_ms,
      })),
  }));

  const initialIndex = defaultCar && defaultTrack
    ? Math.max(0, combos.findIndex((c) => c.car_id === defaultCar && c.track_id === defaultTrack))
    : 0;

  return { combos, initialIndex };
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const tHeader = await getTranslations("Header");
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const now = new Date();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
  const yearAgo = new Date(Date.now() - 365 * 86400000);

  // ── Batch 1 ─────────────────────────────────────────────────────────────
  const [
    summaryRes,
    lastSessionRes,
    recentPbsRes,
    agentStatusRes,
    activityRawRes,
    allSessionsRes,
  ] = await Promise.all([
    supabase.from("profile_summary").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("sessions").select("*").eq("user_id", uid).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("personal_bests").select("*").eq("user_id", uid).order("synced_at", { ascending: false }).limit(8),
    supabase.from("agent_status").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("sessions").select("started_at").eq("user_id", uid).gte("started_at", ninetyDaysAgo.toISOString()),
    supabase
      .from("sessions")
      .select("started_at, best_lap_ms, car_id, track_id")
      .eq("user_id", uid)
      .not("best_lap_ms", "is", null)
      .gte("started_at", yearAgo.toISOString())
      .order("started_at", { ascending: true })
      .limit(300),
  ]);

  const summary = summaryRes.data as ProfileSummary | null;
  if (!summary || summary.total_sessions === 0) return <EmptyState />;

  const lastSession = lastSessionRes.data as Session | null;
  const recentPbs = (recentPbsRes.data ?? []) as PersonalBest[];
  const agentStatus = agentStatusRes.data as AgentStatus | null;

  // Activity calendar
  const activityMap = new Map<string, number>();
  (activityRawRes.data ?? []).forEach((s: { started_at: string }) => {
    const date = s.started_at.split("T")[0];
    activityMap.set(date, (activityMap.get(date) ?? 0) + 1);
  });
  const activityData = Array.from(activityMap.entries()).map(([date, count]) => ({ date, count }));

  // Combo progress data
  const allSessions = (allSessionsRes.data ?? []) as {
    started_at: string;
    best_lap_ms: number;
    car_id: string;
    track_id: string;
  }[];
  const { combos, initialIndex } = buildCombosData(
    allSessions,
    locale,
    lastSession?.car_id,
    lastSession?.track_id
  );

  // ── Batch 2: depends on lastSession ────────────────────────────────────
  let lastPb: PersonalBest | null = null;
  let pbDelta: number | null = null;
  let prevBestMs: number | null = null;
  let qualityBadge = getSessionQualityBadge({ best_lap_ms: null, laps: 0 }, {});

  const [sessionLapsRes, pbRes, comboHistoryRes] = await Promise.all([
    lastSession?.source_id
      ? supabase.from("laps").select("time_ms").eq("user_id", uid).eq("session_source_id", lastSession.source_id).eq("cuts", 0).gt("time_ms", 0)
      : Promise.resolve({ data: [] as { time_ms: number }[] }),
    lastSession
      ? supabase.from("personal_bests").select("*").eq("user_id", uid).eq("car_id", lastSession.car_id).eq("track_id", lastSession.track_id).maybeSingle()
      : Promise.resolve({ data: null }),
    lastSession?.best_lap_ms
      ? supabase
          .from("sessions")
          .select("started_at, best_lap_ms")
          .eq("user_id", uid)
          .eq("car_id", lastSession.car_id)
          .eq("track_id", lastSession.track_id)
          .not("best_lap_ms", "is", null)
          .lt("started_at", lastSession.started_at)
          .order("started_at", { ascending: false })
          .limit(3)
      : Promise.resolve({ data: [] as { started_at: string; best_lap_ms: number }[] }),
  ]);

  let comboHistory: { started_at: string; best_lap_ms: number }[] = [];

  if (lastSession) {
    lastPb = pbRes.data as PersonalBest | null;
    const history = (comboHistoryRes.data ?? []) as { started_at: string; best_lap_ms: number }[];
    prevBestMs = history[0]?.best_lap_ms ?? null;
    comboHistory = history;

    if (lastPb && lastSession.best_lap_ms) {
      pbDelta = lastSession.best_lap_ms - lastPb.time_ms;
    }

    const sessionLapTimes = (sessionLapsRes.data ?? []).map((l: { time_ms: number }) => l.time_ms);
    qualityBadge = getSessionQualityBadge(
      { best_lap_ms: lastSession.best_lap_ms, laps: lastSession.laps },
      {
        previousBestMs: prevBestMs,
        currentSessionAvgMs: calculateAvgLapTime(sessionLapTimes),
        currentSessionStdDev: calculateStdDev(sessionLapTimes),
      }
    );
  }

  // Weekday distribution (Sun=0 … Sat=6) from 90-day activity data
  const weekdayDist = Array(7).fill(0) as number[];
  (activityRawRes.data ?? []).forEach((s: { started_at: string }) => {
    weekdayDist[new Date(s.started_at).getDay()]++;
  });

  const displayName =
    user!.user_metadata?.display_name ?? user!.email?.split("@")[0] ?? "Driver";

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
          <SyncButton userId={uid} />
        </div>
      </div>

      {/* ATIVIDADE */}
      <SectionDivider label={tDash("sectionActivity")} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
        {lastSession ? (
          <LastSessionCard
            session={lastSession}
            qualityBadge={qualityBadge}
            pbTime={lastPb?.time_ms}
            pbDelta={pbDelta}
            comboHistory={comboHistory}
          />
        ) : (
          <div className="bg-card border border-border rounded-md p-5 flex items-center justify-center min-h-[180px]">
            <p className="text-muted-foreground text-sm">{tDash("noSession")}</p>
          </div>
        )}
        <ActivityCalendar
          sessions={activityData}
          daysToShow={90}
          weekdayDist={weekdayDist}
        />
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
        <QuickStatsBar
          tracks={summary.unique_tracks}
          cars={summary.unique_cars}
          distanceKm={summary.total_distance_km}
          laps={summary.total_laps}
        />
      </div>

      {/* PERFORMANCE */}
      <SectionDivider label={tDash("sectionPerformance")} />

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
        <RecentRecordsCard records={recentPbs} />
      </div>

      {combos.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
          <ComboProgressCard combos={combos} initialComboIndex={initialIndex} />
        </div>
      )}

      {/* NAVEGAÇÃO */}
      <div className="animate-in fade-in duration-500 delay-500">
        <QuickNavCards />
      </div>
    </div>
  );
}

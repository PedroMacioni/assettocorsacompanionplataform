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
import { PaceChartClient } from "@/components/charts/PaceChartClient";
import { getSessionQualityBadge } from "@/lib/calculations";
import { formatLapTime, slugToName } from "@/lib/format";
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

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const eightWeeksAgo = new Date(Date.now() - 56 * 86400000);

  const [summaryRes, sessionsWeekRes, lastSessionRes, paceDataRes, pbsRes, agentStatusRes] =
    await Promise.all([
      supabase.from("profile_summary").select("*").eq("user_id", uid).maybeSingle(),
      supabase.from("sessions").select("laps").eq("user_id", uid).gte("started_at", weekStart.toISOString()),
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
        .gte("started_at", eightWeeksAgo.toISOString())
        .order("started_at", { ascending: true }),
      supabase
        .from("personal_bests")
        .select("*")
        .eq("user_id", uid)
        .order("time_ms", { ascending: true })
        .limit(5),
      supabase.from("agent_status").select("*").eq("user_id", uid).maybeSingle(),
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

  let lastPb: PersonalBest | null = null;
  let pbDelta: number | null = null;
  let prevBestMs: number | null = null;

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
    prevBestMs = prev?.data?.best_lap_ms ?? null;

    if (lastPb && lastSession.best_lap_ms) {
      pbDelta = lastSession.best_lap_ms - lastPb.time_ms;
    }
  }

  const qualityBadge = lastSession
    ? getSessionQualityBadge(
        { best_lap_ms: lastSession.best_lap_ms, laps: lastSession.laps },
        { previousBestMs: prevBestMs }
      )
    : null;

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

  const now = new Date();
  const dayLabel = now.toLocaleDateString("pt-BR", { weekday: "long" }).toUpperCase();
  const dateLabel = now.toLocaleDateString("pt-BR", { day: "numeric", month: "long" }).toUpperCase();

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
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

      {/* [1] HERO CARD */}
      <HeroCard
        streak={{ current: 0, record: 0 }}
        consistency={{ score: 0, trend: "stable" }}
        weeklyDigest={{
          laps: weekLaps,
          sessions: weekSessions,
          pbsBeaten: 0,
          deltaVsLastWeek: 0,
        }}
      />

      {/* [2] LAST SESSION + [3] ACTIVITY CALENDAR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lastSession && qualityBadge ? (
          <LastSessionCard
            session={lastSession}
            qualityBadge={qualityBadge}
            pbTime={lastPb?.time_ms}
            pbDelta={pbDelta}
          />
        ) : (
          <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5 flex items-center justify-center min-h-[180px]">
            <p className="text-[#6b6b72] text-sm">Nenhuma sessão ainda</p>
          </div>
        )}
        <ActivityCalendar sessions={[]} daysToShow={90} />
      </div>

      {/* [4] QUICK STATS BAR */}
      <QuickStatsBar
        tracks={summary.unique_tracks}
        cars={summary.unique_cars}
        distanceKm={summary.total_distance_km}
        laps={summary.total_laps}
      />

      {/* [5] PACE EVOLUTION + [6] PERSONAL RECORDS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#6b6b72] mb-1">
                {tPace("title")}
              </p>
              <p className="text-sm text-foreground font-medium">{tPace("subtitle")}</p>
            </div>
            <Link
              href="/analytics?tab=pace"
              className="flex items-center gap-1.5 text-xs text-[#6b6b72] hover:text-[#e8612a] uppercase tracking-wider transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {tPace("fullView")}
            </Link>
          </div>
          <PaceChartClient data={paceData} tracks={topTracks} trackLabels={trackLabels} />
        </div>

        <TopRecordsCard records={personalBests} />
      </div>

      {/* [7] QUICK NAV CARDS */}
      <QuickNavCards />
    </div>
  );
}

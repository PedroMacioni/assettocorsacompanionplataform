"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { formatLapTime, slugToName } from "@/lib/format";
import type { ProfileSummary, Session, PersonalBest, TopCar, TopTrack } from "@/lib/types";

const SessionAreaChart = dynamic(() => import("@/components/charts/SessionAreaChart"), {
  ssr: false,
  loading: () => <div className="h-[140px] bg-muted rounded-md animate-pulse" />,
});

const DisciplinePieChart = dynamic(() => import("@/components/charts/DisciplinePieChart"), {
  ssr: false,
  loading: () => <div className="h-[200px] bg-muted rounded-md animate-pulse" />,
});

const PaceLineChart = dynamic(() => import("@/components/charts/PaceLineChart"), {
  ssr: false,
  loading: () => <div className="h-[200px] bg-muted rounded-md animate-pulse" />,
});

type Props = {
  summary: ProfileSummary;
  sessions: Session[];
  topCars: TopCar[];
  topTracks: TopTrack[];
  personalBests: PersonalBest[];
  initialTab: string;
};

function buildTrajectory(sessions: Session[]): { week: string; sessions: number }[] {
  const now = new Date();
  const weeks: { week: string; sessions: number }[] = [];
  for (let w = 11; w >= 0; w--) {
    const start = new Date(now.getTime() - (w + 1) * 7 * 86400000);
    const end = new Date(now.getTime() - w * 7 * 86400000);
    const label = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const count = sessions.filter((s) => {
      const d = new Date(s.started_at);
      return d >= start && d < end;
    }).length;
    weeks.push({ week: label, sessions: count });
  }
  return weeks;
}

function buildDiscipline(sessions: Session[]): { name: string; value: number }[] {
  const counts: Record<string, number> = {};
  sessions.forEach((s) => {
    const t = s.session_types ?? "Practice";
    counts[t] = (counts[t] ?? 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
}

function buildPaceForChart(
  sessions: Session[],
  carFilter?: string,
  trackFilter?: string
): { data: Record<string, string | number | null>[]; tracks: string[]; trackLabels: Record<string, string> } {
  const filtered = sessions.filter((s) => {
    if (!s.best_lap_ms) return false;
    if (carFilter && s.car_id !== carFilter) return false;
    if (trackFilter && s.track_id !== trackFilter) return false;
    return true;
  });

  const trackCount: Record<string, number> = {};
  filtered.forEach((s) => { trackCount[s.track_id] = (trackCount[s.track_id] ?? 0) + 1; });
  const topTracks = Object.entries(trackCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map((e) => e[0]);

  const dateMap = new Map<string, Record<string, number>>();
  filtered
    .filter((s) => topTracks.includes(s.track_id))
    .forEach((s) => {
      const d = new Date(s.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!dateMap.has(d)) dateMap.set(d, {});
      const entry = dateMap.get(d)!;
      if (!entry[s.track_id] || s.best_lap_ms! < entry[s.track_id]) {
        entry[s.track_id] = s.best_lap_ms!;
      }
    });

  const data = Array.from(dateMap.entries()).map(([date, tracks]) => ({ date, ...tracks }));
  const trackLabels = Object.fromEntries(topTracks.map((t) => [t, slugToName(t)]));
  return { data, tracks: topTracks, trackLabels };
}

function compositeScore(summary: ProfileSummary): number {
  const raw =
    Math.min(summary.total_sessions, 500) * 0.3 +
    Math.min(summary.unique_tracks, 50) * 0.2 +
    Math.min(summary.total_laps, 5000) * 0.5 / 100;
  return Math.min(100, Math.round((raw / (500 * 0.3 + 50 * 0.2 + 50 * 0.5)) * 100));
}

export function AnalyticsDashboard({
  summary,
  sessions,
  topCars,
  topTracks,
  personalBests,
  initialTab,
}: Props) {
  const tAnalytics = useTranslations("Analytics");
  const [activeTab, setActiveTab] = useState(initialTab);
  const [carFilter, setCarFilter] = useState("");
  const [trackFilter, setTrackFilter] = useState("");

  const TABS = [
    { id: "overview", label: tAnalytics("tabs.overview") },
    { id: "pace", label: tAnalytics("tabs.pace") },
    { id: "discipline", label: tAnalytics("tabs.discipline") },
    { id: "records", label: tAnalytics("tabs.records") },
  ];

  function driverLabel(summary: ProfileSummary): string {
    const ratio = summary.total_sessions > 0 ? summary.unique_tracks / summary.total_sessions : 0;
    if (ratio > 0.5) return tAnalytics("driverLabels.trackExplorer");
    if (summary.total_sessions > 100) return tAnalytics("driverLabels.veteran");
    if (summary.total_laps > 1000) return tAnalytics("driverLabels.lapHunter");
    return tAnalytics("driverLabels.consistent");
  }

  function driverBadges(summary: ProfileSummary, score: number): string[] {
    const badges = [];
    if (summary.total_sessions > 0) badges.push(tAnalytics("badges.active"));
    if (summary.unique_tracks > 5) badges.push(tAnalytics("badges.multiTrack"));
    if (score > 50) badges.push(tAnalytics("badges.consistent"));
    return badges.slice(0, 3);
  }

  const trajectory = buildTrajectory(sessions);
  const discipline = buildDiscipline(sessions);
  const score = compositeScore(summary);
  const label = driverLabel(summary);
  const badges = driverBadges(summary, score);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          {tAnalytics("performanceLabel")}
        </p>
        <h1 className="text-2xl font-bold text-foreground">{tAnalytics("title")}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap shrink-0 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Driver DNA */}
          <div className="bg-card border border-border rounded-md p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              {tAnalytics("driverDna")}
            </p>
            <div className="flex items-center justify-between mb-3">
              <p className="text-foreground font-bold text-lg">{label}</p>
              <p className="text-3xl font-bold text-primary">{score}</p>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
              <div className="h-full bg-primary rounded-full" style={{ width: `${score}%` }} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span
                  key={b}
                  className="px-2 py-0.5 bg-primary/[0.12] border border-primary/[0.18] text-primary text-[10px] font-semibold rounded tracking-wider"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Trajectory */}
          <div className="bg-card border border-border rounded-md p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              {tAnalytics("sessionTrajectory")}
            </p>
            <SessionAreaChart data={trajectory} />
          </div>

          {/* Discipline mix */}
          <div className="bg-card border border-border rounded-md p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              {tAnalytics("disciplineMix")}
            </p>
            {discipline.length > 0 ? (
              <DisciplinePieChart data={discipline} />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                {tAnalytics("noData")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Lap Pace */}
      {activeTab === "pace" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <select
              value={carFilter}
              onChange={(e) => setCarFilter(e.target.value)}
              className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:border-primary outline-none"
            >
              <option value="">{tAnalytics("allCars")}</option>
              {topCars.map((c) => (
                <option key={c.car_id} value={c.car_id}>{slugToName(c.car_id)}</option>
              ))}
            </select>
            <select
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value)}
              className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:border-primary outline-none"
            >
              <option value="">{tAnalytics("allTracks")}</option>
              {topTracks.map((t) => (
                <option key={t.track_id} value={t.track_id}>{slugToName(t.track_id)}</option>
              ))}
            </select>
          </div>

          {(() => {
            const { data, tracks, trackLabels } = buildPaceForChart(
              sessions,
              carFilter || undefined,
              trackFilter || undefined
            );
            return (
              <div className="bg-card border border-border rounded-md p-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                  {tAnalytics("bestLapPerSession")}
                </p>
                {data.length > 0 ? (
                  <PaceLineChart data={data} tracks={tracks} trackLabels={trackLabels} />
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                    {tAnalytics("noLapData")}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Tab: Discipline */}
      {activeTab === "discipline" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-md p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              {tAnalytics("topCars")}
            </p>
            <div className="space-y-3">
              {topCars.map((c, i) => (
                <div key={c.car_id} className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs w-4 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{slugToName(c.car_id)}</p>
                    <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${topCars[0] ? (c.sessions / topCars[0].sessions) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{c.sessions} {tAnalytics("sessions")}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-md p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              {tAnalytics("topTracks")}
            </p>
            <div className="space-y-3">
              {topTracks.map((t, i) => (
                <div key={t.track_id} className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs w-4 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{slugToName(t.track_id)}</p>
                    <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${topTracks[0] ? (t.sessions / topTracks[0].sessions) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{t.sessions} {tAnalytics("sessions")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Records */}
      {activeTab === "records" && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {personalBests.map((pb, i) => (
              <div
                key={pb.id}
                className={`bg-card border rounded-md p-5 ${
                  i === 0 ? "border-primary/25" : "border-border"
                }`}
              >
                {i === 0 && (
                  <span className="inline-block px-2 py-0.5 bg-primary/[0.12] border border-primary/[0.18] text-primary text-[10px] font-semibold rounded tracking-wider mb-2">
                    {tAnalytics("fastest")}
                  </span>
                )}
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  {slugToName(pb.track_id)}
                </p>
                <p className="text-foreground font-medium text-sm mb-2">{slugToName(pb.car_id)}</p>
                <p className={`text-2xl font-bold font-mono ${i === 0 ? "text-primary" : "text-foreground"}`}>
                  {formatLapTime(pb.time_ms)}
                </p>
              </div>
            ))}
          </div>
          {personalBests.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-12">{tAnalytics("noPbs")}</p>
          )}
        </div>
      )}
    </div>
  );
}

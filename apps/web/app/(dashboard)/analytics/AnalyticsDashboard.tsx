"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { formatLapTime, slugToName } from "@/lib/format";
import type { ProfileSummary, Session, PersonalBest, TopCar, TopTrack } from "@/lib/types";

const SessionAreaChart = dynamic(() => import("@/components/charts/SessionAreaChart"), {
  ssr: false,
  loading: () => <div className="h-[140px] bg-[#1e1e20] rounded-md animate-pulse" />,
});

const DisciplinePieChart = dynamic(() => import("@/components/charts/DisciplinePieChart"), {
  ssr: false,
  loading: () => <div className="h-[200px] bg-[#1e1e20] rounded-md animate-pulse" />,
});

const PaceLineChart = dynamic(() => import("@/components/charts/PaceLineChart"), {
  ssr: false,
  loading: () => <div className="h-[200px] bg-[#1e1e20] rounded-md animate-pulse" />,
});

type Props = {
  summary: ProfileSummary;
  sessions: Session[];
  topCars: TopCar[];
  topTracks: TopTrack[];
  personalBests: PersonalBest[];
  initialTab: string;
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "pace", label: "Lap Pace" },
  { id: "discipline", label: "Discipline" },
  { id: "records", label: "Records" },
];

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
      const d = new Date(s.started_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
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

function driverLabel(summary: ProfileSummary): string {
  const ratio = summary.total_sessions > 0 ? summary.unique_tracks / summary.total_sessions : 0;
  if (ratio > 0.5) return "Track Explorer";
  if (summary.total_sessions > 100) return "Veteran Driver";
  if (summary.total_laps > 1000) return "Lap Hunter";
  return "Consistent Driver";
}

function driverBadges(summary: ProfileSummary, score: number): string[] {
  const badges = [];
  if (summary.total_sessions > 0) badges.push("ACTIVE");
  if (summary.unique_tracks > 5) badges.push("MULTI-TRACK");
  if (score > 50) badges.push("CONSISTENT");
  return badges.slice(0, 3);
}

export function AnalyticsDashboard({
  summary,
  sessions,
  topCars,
  topTracks,
  personalBests,
  initialTab,
}: Props) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [carFilter, setCarFilter] = useState("");
  const [trackFilter, setTrackFilter] = useState("");

  const trajectory = buildTrajectory(sessions);
  const discipline = buildDiscipline(sessions);
  const score = compositeScore(summary);
  const label = driverLabel(summary);
  const badges = driverBadges(summary, score);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-1">
          Performance · 12-week window
        </p>
        <h1 className="text-2xl font-bold text-white">Driver Analytics</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#2a2a2c]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-[#e8612a] text-white"
                : "border-transparent text-[#6b6b72] hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-3 gap-4">
          {/* Driver DNA / Composite score */}
          <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-4">
              Driver DNA
            </p>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-bold text-lg">{label}</p>
              <p className="text-3xl font-bold text-[#e8612a]">{score}</p>
            </div>
            <div className="h-1.5 bg-[#1e1e20] rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-[#e8612a] rounded-full"
                style={{ width: `${score}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span
                  key={b}
                  className="px-2 py-0.5 bg-[#e8612a20] border border-[#e8612a30] text-[#e8612a] text-[10px] font-semibold rounded tracking-wider"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Trajectory */}
          <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-4">
              Session Trajectory
            </p>
            <SessionAreaChart data={trajectory} />
          </div>

          {/* Discipline mix */}
          <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-4">
              Discipline Mix
            </p>
            {discipline.length > 0 ? (
              <DisciplinePieChart data={discipline} />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-[#6b6b72] text-sm">
                No data
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Lap Pace */}
      {activeTab === "pace" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3">
            <select
              value={carFilter}
              onChange={(e) => setCarFilter(e.target.value)}
              className="bg-[#161618] border border-[#2a2a2c] rounded-md px-3 py-1.5 text-sm text-white focus:border-[#e8612a] outline-none"
            >
              <option value="">All cars</option>
              {topCars.map((c) => (
                <option key={c.car_id} value={c.car_id}>
                  {slugToName(c.car_id)}
                </option>
              ))}
            </select>
            <select
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value)}
              className="bg-[#161618] border border-[#2a2a2c] rounded-md px-3 py-1.5 text-sm text-white focus:border-[#e8612a] outline-none"
            >
              <option value="">All tracks</option>
              {topTracks.map((t) => (
                <option key={t.track_id} value={t.track_id}>
                  {slugToName(t.track_id)}
                </option>
              ))}
            </select>
          </div>

          {/* Chart */}
          {(() => {
            const { data, tracks, trackLabels } = buildPaceForChart(
              sessions,
              carFilter || undefined,
              trackFilter || undefined
            );
            return (
              <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-4">
                  Best Lap Per Session
                </p>
                {data.length > 0 ? (
                  <PaceLineChart data={data} tracks={tracks} trackLabels={trackLabels} />
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-[#6b6b72] text-sm">
                    No lap data for selected filters
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Tab: Discipline */}
      {activeTab === "discipline" && (
        <div className="grid grid-cols-2 gap-4">
          {/* Top cars */}
          <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-4">
              Top Cars
            </p>
            <div className="space-y-3">
              {topCars.map((c, i) => (
                <div key={c.car_id} className="flex items-center gap-3">
                  <span className="text-[#6b6b72] text-xs w-4 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{slugToName(c.car_id)}</p>
                    <div className="h-1 bg-[#1e1e20] rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-[#e8612a] rounded-full"
                        style={{
                          width: `${topCars[0] ? (c.sessions / topCars[0].sessions) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-[#6b6b72] shrink-0">{c.sessions} sessions</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top tracks */}
          <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-4">
              Top Tracks
            </p>
            <div className="space-y-3">
              {topTracks.map((t, i) => (
                <div key={t.track_id} className="flex items-center gap-3">
                  <span className="text-[#6b6b72] text-xs w-4 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{slugToName(t.track_id)}</p>
                    <div className="h-1 bg-[#1e1e20] rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-[#22c55e] rounded-full"
                        style={{
                          width: `${topTracks[0] ? (t.sessions / topTracks[0].sessions) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-[#6b6b72] shrink-0">{t.sessions} sessions</span>
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
                className={`bg-[#161618] border rounded-md p-5 ${
                  i === 0 ? "border-[#e8612a40]" : "border-[#2a2a2c]"
                }`}
              >
                {i === 0 && (
                  <span className="inline-block px-2 py-0.5 bg-[#e8612a20] border border-[#e8612a30] text-[#e8612a] text-[10px] font-semibold rounded tracking-wider mb-2">
                    FASTEST
                  </span>
                )}
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-1">
                  {slugToName(pb.track_id)}
                </p>
                <p className="text-white font-medium text-sm mb-2">{slugToName(pb.car_id)}</p>
                <p className={`text-2xl font-bold font-mono ${i === 0 ? "text-[#e8612a]" : "text-white"}`}>
                  {formatLapTime(pb.time_ms)}
                </p>
              </div>
            ))}
          </div>
          {personalBests.length === 0 && (
            <p className="text-[#6b6b72] text-sm text-center py-12">No personal bests recorded yet</p>
          )}
        </div>
      )}
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { LapTime } from "@/components/LapTime";
import { formatLapTime, formatDistance, formatDate, slugToName } from "@/lib/format";
import type { Session, PersonalBest } from "@/lib/types";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

function sessionBadgeClass(type: string | null): string {
  if (!type) return "";
  const map: Record<string, string> = {
    Hotlap: "bg-[#e8612a20] text-[#e8612a] border border-[#e8612a30]",
    Race: "bg-[#22c55e20] text-[#22c55e] border border-[#22c55e30]",
    Practice: "bg-[#6b6b7220] text-[#6b6b72] border border-[#6b6b7230]",
  };
  return map[type] ?? "bg-[#6b6b7220] text-[#6b6b72] border border-[#6b6b7230]";
}

function formatDeltaMs(ms: number): string {
  const sign = ms < 0 ? "" : "+";
  return `${sign}${(ms / 1000).toFixed(3)}s`;
}

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

  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", user!.id)
    .eq("source_id", id)
    .maybeSingle();

  if (!data) notFound();
  const s = data as Session;

  // Parallel: PB for this car+track + last 5 sessions at this track
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

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <Link
        href="/sessions"
        className="inline-flex items-center gap-1.5 text-xs text-[#6b6b72] hover:text-white transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        All Sessions
      </Link>

      {/* Session header */}
      <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            {s.session_types && (
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide mb-2 ${sessionBadgeClass(s.session_types)}`}
              >
                {s.session_types}
              </span>
            )}
            <h1 className="text-2xl font-bold text-white">{slugToName(s.track_id)}</h1>
            <p className="text-[#6b6b72] mt-0.5">{slugToName(s.car_id)}</p>
            <p className="text-xs text-[#6b6b72] mt-2">{formatDate(s.started_at)}</p>
          </div>
          {pb && s.best_lap_ms && (
            <div className="text-right shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-1">
                vs PB
              </p>
              <p
                className={`text-xl font-bold font-mono ${
                  pbDelta !== null && pbDelta <= 0 ? "text-[#22c55e]" : "text-[#ef4444]"
                }`}
              >
                {pbDelta !== null ? formatDeltaMs(pbDelta) : "—"}
              </p>
              <p className="text-xs text-[#6b6b72] mt-0.5">PB: {formatLapTime(pb.time_ms)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Laps", value: String(s.laps) },
          { label: "Distance", value: formatDistance(s.distance_km) },
          { label: "Best Lap", value: <LapTime ms={s.best_lap_ms} />, hero: true },
          { label: "Last Lap", value: <LapTime ms={s.last_lap_ms} /> },
        ].map(({ label, value, hero }) => (
          <div
            key={label}
            className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-2">
              {label}
            </p>
            <p
              className={`font-bold text-white ${
                hero ? "text-3xl font-mono" : "text-2xl"
              }`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Other sessions at this track */}
      {trackSessions.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-3">
            Other sessions at {slugToName(s.track_id)}
          </p>
          <div className="bg-[#161618] border border-[#2a2a2c] rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2c]">
                  {["Date", "Car", "Type", "Laps", "Best Lap"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] ${
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
                    className="border-b border-[#2a2a2c] last:border-0 hover:bg-[#1e1e20] transition-colors"
                  >
                    <td className="px-4 py-2.5 text-[#6b6b72] text-xs">{formatDate(ts.started_at)}</td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/sessions/${ts.source_id}`}
                        className="text-white hover:text-[#e8612a] transition-colors font-medium text-xs"
                      >
                        {slugToName(ts.car_id)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#6b6b72]">{ts.session_types ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-[#6b6b72]">{ts.laps}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-white text-xs">
                      <LapTime ms={ts.best_lap_ms} />
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
          className="text-[#6b6b72] hover:text-[#e8612a] transition-colors"
        >
          All sessions at {slugToName(s.track_id)} →
        </Link>
        <Link
          href={`/sessions?car=${s.car_id}`}
          className="text-[#6b6b72] hover:text-[#e8612a] transition-colors"
        >
          All sessions with {slugToName(s.car_id)} →
        </Link>
      </div>
    </div>
  );
}

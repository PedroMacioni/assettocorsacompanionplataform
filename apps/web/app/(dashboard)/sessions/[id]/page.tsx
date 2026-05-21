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
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Laps", value: String(s.laps) },
          { label: "Distance", value: formatDistance(s.distance_km) },
          { label: "Best Lap", value: <LapTime ms={s.best_lap_ms} />, hero: true },
          { label: "Last Lap", value: <LapTime ms={s.last_lap_ms} /> },
        ].map(({ label, value, hero }) => (
          <div key={label} className="bg-card border border-border rounded-md p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              {label}
            </p>
            <p className={`font-bold text-foreground ${hero ? "text-3xl font-mono" : "text-2xl"}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Other sessions at this track */}
      {trackSessions.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Other sessions at {slugToName(s.track_id)}
          </p>
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Date", "Car", "Type", "Laps", "Best Lap"].map((h, i) => (
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
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          All sessions at {slugToName(s.track_id)} →
        </Link>
        <Link
          href={`/sessions?car=${s.car_id}`}
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          All sessions with {slugToName(s.car_id)} →
        </Link>
      </div>
    </div>
  );
}

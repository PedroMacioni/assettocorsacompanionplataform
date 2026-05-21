import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { LapTime } from "@/components/LapTime";
import { formatLapTime, formatDistance, formatDate, slugToName } from "@/lib/format";
import type { Session, PersonalBest, TopCar } from "@/lib/types";
import Link from "next/link";
import { cn } from "@/lib/utils";

type SearchParams = { car?: string };

export default async function GaragePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { car: carParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const carsRes = await supabase
    .from("top_cars")
    .select("*")
    .eq("user_id", uid)
    .order("sessions", { ascending: false });

  const topCars = (carsRes.data ?? []) as TopCar[];

  if (topCars.length === 0) {
    return (
      <EmptyState title="No cars in your garage" description="Sync sessions to see your car stats." />
    );
  }

  const selectedCarId = carParam ?? topCars[0].car_id;
  const selectedCar = topCars.find((c) => c.car_id === selectedCarId) ?? topCars[0];

  const [carSessionsRes, carPbsRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .eq("user_id", uid)
      .eq("car_id", selectedCar.car_id)
      .order("started_at", { ascending: false })
      .limit(10),
    supabase
      .from("personal_bests")
      .select("*")
      .eq("user_id", uid)
      .eq("car_id", selectedCar.car_id)
      .order("time_ms", { ascending: true }),
  ]);

  const carSessions = (carSessionsRes.data ?? []) as Session[];
  const carPbs = (carPbsRes.data ?? []) as PersonalBest[];
  const knownTracks = Array.from(new Set(carSessions.map((s) => s.track_id)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Your Cars
        </p>
        <h1 className="text-2xl font-bold text-foreground">Garage</h1>
      </div>

      <div className="flex gap-6">
        {/* Car list — left column */}
        <div className="w-64 shrink-0 space-y-1">
          {topCars.map((c) => {
            const active = c.car_id === selectedCar.car_id;
            return (
              <Link
                key={c.car_id}
                href={`/garage?car=${c.car_id}`}
                className={cn(
                  "relative flex items-center justify-between px-3 py-3 rounded-md transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{slugToName(c.car_id)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{c.sessions} sessions</p>
                </div>
                {active && (
                  <span className="shrink-0 ml-2 text-[10px] font-semibold text-primary uppercase tracking-wider">
                    ●
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Car stats — right panel */}
        <div className="flex-1 space-y-4">
          {/* Car header */}
          <div className="bg-card border border-border rounded-md p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  {selectedCar.sessions === topCars[0].sessions ? "FAVORITE · " : ""}
                  {selectedCar.sessions} SESSIONS
                </p>
                <h2 className="text-2xl font-bold text-foreground">{slugToName(selectedCar.car_id)}</h2>
              </div>
              <div className="grid grid-cols-3 gap-6 text-right shrink-0">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Best Lap</p>
                  <p className="text-lg font-bold font-mono text-primary">
                    {formatLapTime(selectedCar.best_lap_ms)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Distance</p>
                  <p className="text-lg font-bold text-foreground">
                    {formatDistance(selectedCar.total_distance_km)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Laps</p>
                  <p className="text-lg font-bold text-foreground">
                    {selectedCar.total_laps.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Recent sessions */}
            <div className="bg-card border border-border rounded-md p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Recent Sessions
              </p>
              {carSessions.length > 0 ? (
                <div className="space-y-2">
                  {carSessions.slice(0, 6).map((s) => (
                    <Link
                      key={s.id}
                      href={`/sessions/${s.source_id}`}
                      className="flex items-center justify-between py-1.5 hover:opacity-80 transition-opacity"
                    >
                      <div>
                        <p className="text-xs text-foreground font-medium">{slugToName(s.track_id)}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(s.started_at)}</p>
                      </div>
                      <p className="text-xs font-mono font-semibold text-foreground shrink-0 ml-3">
                        {formatLapTime(s.best_lap_ms)}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No sessions yet</p>
              )}
            </div>

            {/* Known tracks */}
            <div className="bg-card border border-border rounded-md p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Known Tracks
              </p>
              {knownTracks.length > 0 ? (
                <div className="space-y-2">
                  {knownTracks.map((trackId) => {
                    const pb = carPbs.find((p) => p.track_id === trackId);
                    return (
                      <div key={trackId} className="flex items-center justify-between py-1.5">
                        <Link
                          href={`/sessions?car=${selectedCar.car_id}&track=${trackId}`}
                          className="text-xs text-foreground font-medium hover:text-primary transition-colors truncate"
                        >
                          {slugToName(trackId)}
                        </Link>
                        {pb && (
                          <p className="text-xs font-mono font-semibold text-primary shrink-0 ml-3">
                            {formatLapTime(pb.time_ms)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No track data</p>
              )}
            </div>
          </div>

          {/* Personal bests for this car */}
          {carPbs.length > 0 && (
            <div className="bg-card border border-border rounded-md p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Personal Bests with {slugToName(selectedCar.car_id)}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {carPbs.map((pb, i) => (
                  <div
                    key={pb.id}
                    className={`p-3 rounded-md border ${
                      i === 0 ? "bg-primary/5 border-primary/[0.18]" : "bg-muted border-border"
                    }`}
                  >
                    <p className="text-[10px] text-muted-foreground truncate mb-1">
                      {slugToName(pb.track_id)}
                    </p>
                    <p className={`text-base font-bold font-mono ${i === 0 ? "text-primary" : "text-foreground"}`}>
                      {formatLapTime(pb.time_ms)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

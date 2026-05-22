import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/EmptyState";
import { formatLapTime, formatDistance, formatDate, slugToName } from "@/lib/format";
import type { Session, PersonalBest, TopCar, UserCarPreference } from "@/lib/types";
import Link from "next/link";
import { GarageCarList } from "./GarageCarList";
import { EditCarNameButton } from "./EditCarNameButton";
import { CarBannerImage } from "./CarBannerImage";

type SearchParams = { car?: string };

export default async function GaragePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const t = await getTranslations("Garage");
  const { car: carParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const [carsRes, prefsRes] = await Promise.all([
    supabase.from("top_cars").select("*").eq("user_id", uid).order("sessions", { ascending: false }),
    supabase.from("user_car_preferences").select("*").eq("user_id", uid),
  ]);

  const topCars = (carsRes.data ?? []) as TopCar[];
  const prefs = (prefsRes.data ?? []) as UserCarPreference[];
  const prefMap: Record<string, string | null> = Object.fromEntries(
    prefs.map((p) => [p.car_id, p.display_name])
  );

  if (topCars.length === 0) {
    return <EmptyState title={t("empty.title")} description={t("empty.description")} />;
  }

  const selectedCarId = carParam ?? topCars[0].car_id;
  const selectedCar = topCars.find((c) => c.car_id === selectedCarId) ?? topCars[0];
  const displayName = prefMap[selectedCar.car_id] ?? slugToName(selectedCar.car_id);
  const originalName = slugToName(selectedCar.car_id);

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

  const totalSessions = topCars.reduce((sum, c) => sum + c.sessions, 0);
  const totalDistance = topCars.reduce((sum, c) => sum + (c.total_distance_km ?? 0), 0);
  const isFavorite = selectedCar.sessions === topCars[0].sessions && topCars.length > 1;

  const carImageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/car-previews/${uid}`;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("yourCars")}
        </p>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{topCars.length}</span>
          <span>{topCars.length === 1 ? t("summary.carsOne") : t("summary.carsOther")}</span>
          <span className="opacity-30">·</span>
          <span className="font-semibold text-foreground">{totalSessions.toLocaleString()}</span>
          <span>{totalSessions === 1 ? t("summary.sessionsOne") : t("summary.sessionsOther")}</span>
          <span className="opacity-30">·</span>
          <span className="font-semibold text-foreground">{formatDistance(totalDistance)}</span>
          <span>{t("summary.driven")}</span>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Car list sidebar — client component handles search */}
        <GarageCarList
          cars={topCars}
          preferences={prefMap}
          selectedCarId={selectedCar.car_id}
          carImageBase={carImageBase}
        />

        {/* Car detail panel */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Car banner card */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Banner */}
            <div className="h-44 relative">
              <CarBannerImage src={`${carImageBase}/${selectedCar.car_id}.png`} alt={displayName} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  {isFavorite && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
                      ★ {t("car.favorite")}
                    </p>
                  )}
                  <h2 className="text-2xl font-bold text-white truncate">{displayName}</h2>
                  {prefMap[selectedCar.car_id] && (
                    <p className="text-xs text-white/50 mt-0.5 truncate">{originalName}</p>
                  )}
                </div>
                <div className="shrink-0">
                  <EditCarNameButton
                    carId={selectedCar.car_id}
                    currentDisplayName={prefMap[selectedCar.car_id] ?? null}
                    originalName={originalName}
                  />
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 divide-x divide-border border-t border-border">
              {[
                { label: t("car.sessions"), value: selectedCar.sessions.toLocaleString(), mono: false },
                { label: t("car.bestLap"), value: formatLapTime(selectedCar.best_lap_ms), mono: true, highlight: true },
                { label: t("car.distance"), value: formatDistance(selectedCar.total_distance_km), mono: false },
                { label: t("car.laps"), value: selectedCar.total_laps.toLocaleString(), mono: false },
              ].map((stat) => (
                <div key={stat.label} className="p-4 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    {stat.label}
                  </p>
                  <p
                    className={[
                      "text-lg font-bold",
                      stat.mono ? "font-mono" : "",
                      stat.highlight ? "text-primary" : "text-foreground",
                    ].join(" ")}
                  >
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Sessions + Tracks */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                {t("sections.recentSessions")}
              </p>
              {carSessions.length > 0 ? (
                <div className="space-y-1">
                  {carSessions.slice(0, 6).map((s) => (
                    <Link
                      key={s.id}
                      href={`/sessions/${s.source_id}`}
                      className="flex items-center justify-between py-1.5 hover:opacity-70 transition-opacity"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-foreground font-medium truncate">
                          {slugToName(s.track_id)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(s.started_at)}</p>
                      </div>
                      <p className="text-xs font-mono font-semibold text-foreground shrink-0 ml-3">
                        {formatLapTime(s.best_lap_ms)}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("sections.noSessions")}</p>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                {t("sections.knownTracks")}
              </p>
              {knownTracks.length > 0 ? (
                <div className="space-y-1">
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
                <p className="text-sm text-muted-foreground">{t("sections.noTracks")}</p>
              )}
            </div>
          </div>

          {/* Personal bests */}
          {carPbs.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                {t("sections.personalBests")}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {carPbs.map((pb, i) => (
                  <div
                    key={pb.id}
                    className={`p-3 rounded-lg border ${
                      i === 0 ? "bg-primary/5 border-primary/20" : "bg-muted/40 border-border"
                    }`}
                  >
                    <p className="text-[10px] text-muted-foreground truncate mb-1">
                      {slugToName(pb.track_id)}
                    </p>
                    <p
                      className={`text-base font-bold font-mono ${i === 0 ? "text-primary" : "text-foreground"}`}
                    >
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

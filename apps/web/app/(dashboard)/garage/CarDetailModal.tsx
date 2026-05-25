"use client";

import { useEffect, useState, useTransition } from "react";
import { X, Star, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { slugToName, formatLapTime, formatDistance } from "@/lib/format";
import { CarSetups } from "./CarSetups";
import { getCarModalData, toggleCarFavorite, type CarModalData } from "./actions";
import { EditCarNameButton } from "./EditCarNameButton";
import type { TopCar, CarSpecs, UserCarPreference } from "@/lib/types";

interface Props {
  car: TopCar;
  specs: CarSpecs | null;
  pref: UserCarPreference | null;
  carImageSrc: string;
  onClose: () => void;
  onFavoriteChange: (carId: string, isFavorite: boolean) => void;
}

export function CarDetailModal({ car, specs, pref, carImageSrc, onClose, onFavoriteChange }: Props) {
  const [data, setData] = useState<CarModalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgFailed, setImgFailed] = useState(false);
  const [isFavorite, setIsFavorite] = useState(pref?.is_favorite ?? false);
  const [, startTransition] = useTransition();

  const displayName = pref?.display_name ?? specs?.name ?? slugToName(car.car_id);

  useEffect(() => {
    getCarModalData(car.car_id).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [car.car_id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleFavoriteToggle = () => {
    const next = !isFavorite;
    setIsFavorite(next);
    startTransition(async () => {
      await toggleCarFavorite(car.car_id, next);
      onFavoriteChange(car.car_id, next);
    });
  };

  const bestLap = data?.tracks.reduce<{ lap: number; track: string } | null>((best, t) => {
    if (!t.best_lap_ms) return best;
    if (!best || t.best_lap_ms < best.lap) return { lap: t.best_lap_ms, track: t.track_id };
    return best;
  }, null) ?? (car.best_lap_ms ? { lap: car.best_lap_ms, track: "" } : null);

  const pwRatio = specs?.bhp && specs?.weight
    ? Math.round((specs.bhp * 1000) / specs.weight)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Fechar"
        className="fixed top-4 right-4 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-muted/80 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors backdrop-blur-sm"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="max-w-6xl mx-auto px-4 py-10 md:px-8 space-y-6">

        {/* ── HEADER ───────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          {/* Left: name + meta */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                onClick={handleFavoriteToggle}
                aria-label={isFavorite ? "Remover dos favoritos" : "Favoritar"}
                className="focus:outline-none"
              >
                <Star
                  className={cn(
                    "w-4 h-4 transition-colors",
                    isFavorite ? "text-primary fill-primary" : "text-muted-foreground/40 hover:text-primary"
                  )}
                />
              </button>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                {isFavorite ? "FAVORITO · " : ""}{car.sessions} SESSÕES
              </p>
            </div>

            <div className="flex items-center gap-2">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight leading-none">
                {displayName}
              </h1>
              <EditCarNameButton
                carId={car.car_id}
                currentDisplayName={pref?.display_name ?? null}
                originalName={slugToName(car.car_id)}
                variant="default"
              />
            </div>

            <p className="text-sm text-muted-foreground">
              {[specs?.year, specs?.class, specs?.drivetrain].filter(Boolean).join(" · ")}
            </p>
          </div>

          {/* Right: stats */}
          <div className="flex items-start gap-8 md:gap-10 shrink-0">
            {bestLap && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  BEST LAP{bestLap.track ? ` · ${slugToName(bestLap.track).toUpperCase()}` : ""}
                </p>
                <p className="text-3xl md:text-4xl font-bold font-mono text-primary leading-none">
                  {formatLapTime(bestLap.lap)}
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide">Personal record</p>
              </div>
            )}
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">DISTÂNCIA</p>
              <p className="text-3xl md:text-4xl font-bold font-mono text-foreground leading-none">
                {formatDistance(car.total_distance_km)}
              </p>
            </div>
          </div>
        </div>

        <div className="w-full h-px bg-border" />

        {/* ── MAIN GRID ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left column (col-span-3) */}
          <div className="lg:col-span-3 space-y-6">

            {/* Car image */}
            <div className="relative bg-muted/30 border border-border rounded-2xl overflow-hidden h-72 flex items-center justify-center">
              <p className="absolute top-3 left-4 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                CAR RENDER
              </p>
              {!imgFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={carImageSrc}
                  alt={displayName}
                  onError={() => setImgFailed(true)}
                  className="max-h-full max-w-full object-contain drop-shadow-2xl"
                />
              ) : (
                <Car className="w-24 h-24 text-muted-foreground/20" strokeWidth={0.8} />
              )}
            </div>

            {/* Setups */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                SAVED SETUPS
              </p>
              {loading ? (
                <SetupsSkeleton />
              ) : (
                <CarSetups setups={data?.setups ?? []} />
              )}
            </div>
          </div>

          {/* Right column (col-span-2) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Spec sheet */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                SPEC SHEET
              </p>
              {specs ? (
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  {[
                    { label: "POWER",      value: specs.bhp      ? `${specs.bhp} hp`         : null },
                    { label: "WEIGHT",     value: specs.weight   ? `${specs.weight} kg`       : null },
                    { label: "0–100",      value: specs.acceleration ? `${(specs.acceleration / 10).toFixed(1)} s` : null },
                    { label: "TOP SPEED",  value: specs.top_speed ? `${specs.top_speed} km/h` : null },
                    { label: "DRIVETRAIN", value: specs.drivetrain ?? null },
                    { label: "P/W RATIO",  value: pwRatio ? `${pwRatio} hp/t` : null },
                    { label: "TORQUE",     value: specs.torque   ? `${specs.torque} Nm`       : null },
                  ].filter(s => s.value).map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
                        {label}
                      </p>
                      <p className="text-xl font-bold text-foreground font-mono leading-tight">{value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Especificações não disponíveis. Aguardando sincronização do agente.
                </p>
              )}
            </div>

            {/* Known tracks */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                PISTAS CONHECIDAS
              </p>
              {loading ? (
                <TracksSkeleton />
              ) : data?.tracks && data.tracks.length > 0 ? (
                <div className="space-y-3">
                  {data.tracks.map((track) => (
                    <div key={track.track_id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {slugToName(track.track_id)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {track.sessions} {track.sessions === 1 ? "sessão" : "sessões"}
                        </p>
                      </div>
                      {track.best_lap_ms && (
                        <p className="text-sm font-bold font-mono text-primary shrink-0">
                          {formatLapTime(track.best_lap_ms)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma pista registrada.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupsSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 bg-muted/60 rounded-lg" />
      ))}
    </div>
  );
}

function TracksSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-9 bg-muted/60 rounded-lg" />
      ))}
    </div>
  );
}

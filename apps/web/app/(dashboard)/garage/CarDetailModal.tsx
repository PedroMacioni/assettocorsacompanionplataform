"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { slugToName, formatLapTime, formatDistance } from "@/lib/format";
import { CarSpecs } from "./CarSpecs";
import { CarTracks } from "./CarTracks";
import { CarSetups } from "./CarSetups";
import { getCarModalData, toggleCarFavorite, type CarModalData } from "./actions";
import { EditCarNameButton } from "./EditCarNameButton";
import type { TopCar, CarSpecs as CarSpecsType, UserCarPreference } from "@/lib/types";

interface Props {
  car: TopCar;
  specs: CarSpecsType | null;
  pref: UserCarPreference | null;
  onClose: () => void;
  onFavoriteChange: (carId: string, isFavorite: boolean) => void;
}

const SECTIONS = [
  { id: "specs", label: "Specs" },
  { id: "tracks", label: "Pistas" },
  { id: "setups", label: "Setups" },
] as const;

export function CarDetailModal({ car, specs, pref, onClose, onFavoriteChange }: Props) {
  const [data, setData] = useState<CarModalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"specs" | "tracks" | "setups">("specs");
  const [isFavorite, setIsFavorite] = useState(pref?.is_favorite ?? false);
  const [, startTransition] = useTransition();
  const overlayRef = useRef<HTMLDivElement>(null);
  const displayName = pref?.display_name ?? specs?.name ?? slugToName(car.car_id);

  useEffect(() => {
    getCarModalData(car.car_id).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [car.car_id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

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
  }, null);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className={cn(
          "relative z-10 w-full sm:max-w-2xl bg-card border border-border",
          "rounded-t-2xl sm:rounded-2xl shadow-2xl",
          "max-h-[92dvh] sm:max-h-[85dvh] flex flex-col",
          "focus:outline-none"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={displayName}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={handleFavoriteToggle}
                  aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                  className="focus:outline-none"
                >
                  <Star
                    className={cn(
                      "w-4 h-4 transition-colors",
                      isFavorite ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/40 hover:text-yellow-400"
                    )}
                  />
                </button>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {car.sessions} sessões
                </span>
              </div>

              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-foreground leading-tight truncate">{displayName}</h2>
                <EditCarNameButton
                  carId={car.car_id}
                  currentDisplayName={pref?.display_name ?? null}
                  originalName={slugToName(car.car_id)}
                  variant="default"
                />
              </div>

              <p className="text-xs text-muted-foreground mt-0.5">
                {[specs?.year, specs?.class, specs?.drivetrain].filter(Boolean).join(" · ")}
              </p>
            </div>

            <div className="shrink-0 text-right">
              {bestLap && (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Best Lap · {slugToName(bestLap.track)}
                  </p>
                  <p className="text-xl font-bold font-mono text-primary">{formatLapTime(bestLap.lap)}</p>
                </>
              )}
              <div className="flex gap-4 justify-end mt-1">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Distância</p>
                  <p className="text-xs font-semibold text-foreground">{formatDistance(car.total_distance_km)}</p>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Fechar"
              className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Section nav */}
        <div className="flex border-b border-border shrink-0 px-5">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "px-3 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors border-b-2 -mb-px",
                activeSection === s.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <ModalSkeleton />
          ) : (
            <>
              {activeSection === "specs" && (
                <CarSpecs specs={data?.specs ?? null} />
              )}
              {activeSection === "tracks" && (
                <CarTracks tracks={data?.tracks ?? []} />
              )}
              {activeSection === "setups" && (
                <CarSetups setups={data?.setups ?? []} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-16 bg-muted/60 rounded-lg" />
      ))}
    </div>
  );
}

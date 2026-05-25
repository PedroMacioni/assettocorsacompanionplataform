"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, Star, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { slugToName, formatLapTime, formatDistance } from "@/lib/format";
import { SetupDetailPanel } from "./SetupDetailPanel";
import { getCarModalData, toggleCarFavorite, type CarModalData } from "./actions";
import { EditCarNameButton } from "./EditCarNameButton";
import type { TopCar, CarSpecs, UserCarPreference, CarSetup } from "@/lib/types";

interface Props {
  car: TopCar;
  specs: CarSpecs | null;
  pref: UserCarPreference | null;
  carImageSrc: string;
  onClose: () => void;
  onFavoriteChange: (carId: string, isFavorite: boolean) => void;
}

export function CarDetail({ car, specs, pref, carImageSrc, onClose, onFavoriteChange }: Props) {
  const [data, setData] = useState<CarModalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgFailed, setImgFailed] = useState(false);
  const [isFavorite, setIsFavorite] = useState(pref?.is_favorite ?? false);
  const [selectedSetup, setSelectedSetup] = useState<CarSetup | null>(null);
  const [, startTransition] = useTransition();

  const displayName = pref?.display_name ?? specs?.name ?? slugToName(car.car_id);

  useEffect(() => {
    getCarModalData(car.car_id).then((d) => {
      setData(d);
      const active = d.setups.find((s) => s.is_active) ?? d.setups[0] ?? null;
      setSelectedSetup(active);
      setLoading(false);
    });
  }, [car.car_id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  const pwRatio =
    specs?.bhp && specs?.weight ? Math.round((specs.bhp * 1000) / specs.weight) : null;

  const specItems = [
    { label: "POWER",      value: specs?.bhp        ? `${specs.bhp} hp`         : null },
    { label: "WEIGHT",     value: specs?.weight     ? `${specs.weight} kg`       : null },
    { label: "0–100",      value: specs?.acceleration ? `${(specs.acceleration / 10).toFixed(1)} s` : null },
    { label: "TOP SPEED",  value: specs?.top_speed  ? `${specs.top_speed} km/h`  : null },
    { label: "DRIVETRAIN", value: specs?.drivetrain  ?? null },
    { label: "P/W RATIO",  value: pwRatio           ? `${pwRatio} hp/t`          : null },
  ].filter((s) => s.value);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">

      {/* ── BACK + HEADER ──────────────────────────────────────── */}
      <div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para a garagem
        </button>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          {/* Left: name */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button onClick={handleFavoriteToggle} aria-label="Favoritar" className="focus:outline-none">
                <Star
                  className={cn(
                    "w-3.5 h-3.5 transition-colors",
                    isFavorite ? "text-primary fill-primary" : "text-muted-foreground/40 hover:text-primary"
                  )}
                />
              </button>
              <p className="text-[9px] font-bold uppercase tracking-widest text-primary">
                {isFavorite && "FAVORITO · "}{car.sessions} SESSÕES
              </p>
            </div>

            <div className="flex items-center gap-2">
              <h1 className="text-4xl font-bold text-foreground tracking-tight leading-none">
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
          <div className="flex items-start gap-8 shrink-0">
            {bestLap && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  BEST LAP{bestLap.track ? ` · ${slugToName(bestLap.track).toUpperCase()}` : ""}
                </p>
                <p className="text-3xl font-bold font-mono text-primary leading-none">
                  {formatLapTime(bestLap.lap)}
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide">
                  Personal record
                </p>
              </div>
            )}
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                DISTÂNCIA
              </p>
              <p className="text-3xl font-bold font-mono text-foreground leading-none">
                {formatDistance(car.total_distance_km)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-border" />

      {/* ── MAIN GRID ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ── LEFT COL (3): imagem + pistas ─────────────────── */}
        <div className="lg:col-span-3 space-y-5">

          {/* Car image */}
          <div className="relative bg-muted/20 border border-border rounded-2xl overflow-hidden h-64 flex items-center justify-center">
            <p className="absolute top-3 left-4 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              CAR RENDER
            </p>
            {!imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={carImageSrc}
                alt={displayName}
                onError={() => setImgFailed(true)}
                className="max-h-full max-w-full object-contain drop-shadow-xl"
              />
            ) : (
              <Car className="w-20 h-20 text-muted-foreground/15" strokeWidth={0.75} />
            )}
          </div>

          {/* Pistas com tempos */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              PISTAS CONHECIDAS
            </p>
            {loading ? (
              <Skeleton rows={4} />
            ) : data?.tracks && data.tracks.length > 0 ? (
              <div className="space-y-0">
                {data.tracks.map((track, i) => (
                  <div
                    key={track.track_id}
                    className={cn(
                      "flex items-center justify-between py-3 gap-3",
                      i < data.tracks.length - 1 && "border-b border-border/50"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {slugToName(track.track_id)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {track.sessions} {track.sessions === 1 ? "sessão" : "sessões"}
                      </p>
                    </div>
                    {track.best_lap_ms ? (
                      <p className="text-sm font-bold font-mono text-primary shrink-0">
                        {formatLapTime(track.best_lap_ms)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground shrink-0">—</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma pista registrada.</p>
            )}
          </div>
        </div>

        {/* ── RIGHT COL (2): specs + setup detalhado ────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Spec sheet */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              SPEC SHEET
            </p>
            {specItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                {specItems.map(({ label, value }) => (
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
                Specs indisponíveis — aguardando sincronização do agente.
              </p>
            )}
          </div>

          {/* Setup detalhado */}
          <div className="bg-card border border-border rounded-2xl p-5">
            {loading ? (
              <Skeleton rows={3} />
            ) : data?.setups && data.setups.length > 0 ? (
              <>
                {/* Setup selector */}
                {data.setups.length > 1 && (
                  <div className="mb-4">
                    <select
                      value={selectedSetup?.id ?? ""}
                      onChange={(e) => {
                        const s = data.setups.find((x) => x.id === e.target.value) ?? null;
                        setSelectedSetup(s);
                      }}
                      className="w-full text-xs bg-muted border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 appearance-none"
                    >
                      {data.setups.map((s) => (
                        <option key={s.id} value={s.id}>
                          {slugToName(s.track_id)} · {s.name}
                          {s.is_active ? " (ativo)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {selectedSetup ? (
                  <SetupDetailPanel setup={selectedSetup} />
                ) : null}
              </>
            ) : (
              <>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  SETUP
                </p>
                <p className="text-sm text-muted-foreground">
                  Nenhum setup importado. Configure o agente para sincronizar.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-8 bg-muted/60 rounded-lg" style={{ opacity: 1 - i * 0.2 }} />
      ))}
    </div>
  );
}

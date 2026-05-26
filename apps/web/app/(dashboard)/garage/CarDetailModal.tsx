"use client";

import { useEffect, useState, useTransition, useCallback, useRef } from "react";
import { ArrowLeft, Star, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { slugToName, formatLapTime, formatDistance, formatDate } from "@/lib/format";
import { SetupDetailPanel } from "./SetupDetailPanel";
import { getCarModalData, getCarTracks, toggleCarFavorite, type CarModalData, type CarTracksPage, type CarTrack } from "./actions";
import { EditCarNameButton } from "./EditCarNameButton";
import { PaginationClient } from "@/components/ui/pagination-client";
import type { TopCar, CarSpecs, UserCarPreference, CarSetup } from "@/lib/types";

interface Props {
  car: TopCar;
  specs: CarSpecs | null;
  pref: UserCarPreference | null;
  onClose: () => void;
  onFavoriteChange: (carId: string, isFavorite: boolean) => void;
}

export function CarDetail({ car, specs, pref, onClose, onFavoriteChange }: Props) {
  const [data, setData]                     = useState<CarModalData | null>(null);
  const [tracksPage, setTracksPage]         = useState<CarTracksPage | null>(null);
  const [tracksLoading, setTracksLoading]   = useState(true);
  const [mainLoading, setMainLoading]       = useState(true);
  const [isFavorite, setIsFavorite]         = useState(pref?.is_favorite ?? false);
  const [selectedSetup, setSelectedSetup]   = useState<CarSetup | null>(null);
  const [search, setSearch]                 = useState("");
  const debounceRef                         = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [, startTransition]                 = useTransition();

  const displayName = pref?.display_name ?? specs?.name ?? slugToName(car.car_id);

  // Carrega specs + setups (uma vez)
  useEffect(() => {
    getCarModalData(car.car_id).then((d) => {
      setData(d);
      const active = d.setups.find((s) => s.is_active) ?? d.setups[0] ?? null;
      setSelectedSetup(active);
      setMainLoading(false);
    });
  }, [car.car_id]);

  // Carrega pistas (paginado — só o card de pistas)
  const loadTracks = useCallback((page: number, q?: string) => {
    setTracksLoading(true);
    getCarTracks(car.car_id, page, q).then((p) => {
      setTracksPage(p);
      setTracksLoading(false);
    });
  }, [car.car_id]);

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadTracks(1, value), 280);
  };

  useEffect(() => { loadTracks(1); }, [loadTracks]);

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

  const bestLap = tracksPage?.tracks.reduce<{ lap: number; track: string } | null>((best, t) => {
    if (!t.best_lap_ms) return best;
    if (!best || t.best_lap_ms < best.lap) return { lap: t.best_lap_ms, track: t.track_id };
    return best;
  }, null) ?? (car.best_lap_ms ? { lap: car.best_lap_ms, track: "" } : null);

  // Spec sheet — remove p/w, protege 0-100 contra valores absurdos
  const accelRaw   = specs?.acceleration ?? null;
  const accelSafe  = accelRaw !== null && accelRaw >= 10 && accelRaw <= 200 ? `${(accelRaw / 10).toFixed(1)} s` : null;

  const specItems = [
    { label: "POTÊNCIA",   value: specs?.bhp        ? `${specs.bhp} hp`         : null },
    { label: "TORQUE",     value: specs?.torque     ? `${specs.torque} Nm`       : null },
    { label: "PESO",       value: specs?.weight     ? `${specs.weight} kg`       : null },
    { label: "VEL. MÁX",  value: specs?.top_speed  ? `${specs.top_speed} km/h`  : null },
    { label: "TRAÇÃO",     value: specs?.drivetrain ?? null },
    { label: "0–100",      value: accelSafe },
  ].filter((s) => s.value !== null) as { label: string; value: string }[];

  // Setup por pista — ignora genérico (só mostra setup específico por pista)
  function getTrackSetup(trackId: string): CarSetup | null {
    if (!data) return null;
    return data.setups
      .filter((s) => s.track_id === trackId)
      .sort((a, b) => (a.best_lap_ms ?? Infinity) - (b.best_lap_ms ?? Infinity))[0] ?? null;
  }

  const selectClass = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 appearance-none";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para a garagem
        </button>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button onClick={handleFavoriteToggle} aria-label="Favoritar" className="focus:outline-none">
                <Star className={cn("w-3.5 h-3.5 transition-colors", isFavorite ? "text-primary fill-primary" : "text-muted-foreground/40 hover:text-primary")} />
              </button>
              <p className="text-[9px] font-bold uppercase tracking-widest text-primary">
                {isFavorite && "FAVORITO · "}{car.sessions} SESSÕES
              </p>
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-4xl font-bold text-foreground tracking-tight leading-none">{displayName}</h1>
              <EditCarNameButton carId={car.car_id} currentDisplayName={pref?.display_name ?? null} originalName={slugToName(car.car_id)} variant="default" />
            </div>
            <p className="text-sm text-muted-foreground">
              {[specs?.year, specs?.class, specs?.drivetrain].filter(Boolean).join(" · ")}
            </p>
          </div>

          <div className="flex items-start gap-8 shrink-0">
            {bestLap && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  BEST LAP{bestLap.track ? ` · ${slugToName(bestLap.track).toUpperCase()}` : ""}
                </p>
                <p className="text-3xl font-bold font-mono text-primary leading-none">{formatLapTime(bestLap.lap)}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide">Personal record</p>
              </div>
            )}
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">DISTÂNCIA</p>
              <p className="text-3xl font-bold font-mono text-foreground leading-none">{formatDistance(car.total_distance_km)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-border" />

      {/* ── GRID ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ── PISTAS (col 2) ─────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              PISTAS CONHECIDAS
              {tracksPage && <span className="ml-2 font-normal opacity-60">· {tracksPage.total}</span>}
            </p>

            {/* Busca */}
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Buscar pista..."
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-input bg-background text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/50"
              />
            </div>

            {tracksLoading ? (
              <Skeleton rows={5} />
            ) : tracksPage && tracksPage.tracks.length > 0 ? (
              <>
                <TrackList
                  tracks={tracksPage.tracks}
                  selectedSetup={selectedSetup}
                  getTrackSetup={getTrackSetup}
                  onSelectSetup={setSelectedSetup}
                />
                {!search && (
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <PaginationClient
                      currentPage={tracksPage.page}
                      totalPages={tracksPage.totalPages}
                      onPageChange={(p) => loadTracks(p, search)}
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                {search ? "Nenhuma pista encontrada." : "Nenhuma pista registrada."}
              </p>
            )}
          </div>
        </div>

        {/* ── SPECS + SETUP (col 3) ──────────────────────────── */}
        <div className="lg:col-span-3 space-y-5">

          {/* Spec Sheet */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              ESPECIFICAÇÕES
            </p>
            {specItems.length > 0 ? (
              <div className="grid grid-cols-3 gap-x-4 gap-y-5">
                {specItems.map(({ label, value }) => (
                  <div key={label} className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
                    <p className="text-lg font-bold text-foreground font-mono leading-tight truncate">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aguardando sincronização do agente.</p>
            )}
          </div>

          {/* Setup */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              SETUP
            </p>
            {mainLoading ? (
              <Skeleton rows={4} />
            ) : data?.setups && data.setups.length > 0 ? (
              <>
                {data.setups.length > 1 && (
                  <div className="mb-4">
                    <select
                      value={selectedSetup?.id ?? ""}
                      onChange={(e) => {
                        const s = data.setups.find((x) => x.id === e.target.value) ?? null;
                        setSelectedSetup(s);
                      }}
                      className={selectClass}
                    >
                      {data.setups.map((s) => (
                        <option key={s.id} value={s.id}>
                          {slugToName(s.track_id)} · {s.name}{s.is_active ? " (ativo)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {selectedSetup && <SetupDetailPanel setup={selectedSetup} />}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum setup importado. Configure o agente para sincronizar.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function TrackList({
  tracks,
  selectedSetup,
  getTrackSetup,
  onSelectSetup,
}: {
  tracks: CarTrack[];
  selectedSetup: CarSetup | null;
  getTrackSetup: (id: string) => CarSetup | null;
  onSelectSetup: (s: CarSetup) => void;
}) {
  return (
    <div className="space-y-1.5">
      {tracks.map((track) => {
        const trackSetup = getTrackSetup(track.track_id);
        const isActive   = selectedSetup?.id === trackSetup?.id && trackSetup !== null;
        const hasSetup   = trackSetup !== null;

        return (
          <div
            key={track.track_id}
            className={cn(
              "flex items-center justify-between px-3 py-2.5 rounded-xl gap-3 transition-colors",
              hasSetup
                ? isActive
                  ? "border border-primary bg-primary/5"
                  : "border border-border hover:border-primary/50 cursor-pointer"
                : "border border-transparent"
            )}
            onClick={() => trackSetup && onSelectSetup(trackSetup)}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">
                {slugToName(track.track_id)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {track.last_played_at ? formatDate(track.last_played_at) : "—"}
              </p>
            </div>

            <div className="shrink-0">
              {track.best_lap_ms ? (
                <p className="text-sm font-bold font-mono text-primary">
                  {formatLapTime(track.best_lap_ms)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">—</p>
              )}
            </div>
          </div>
        );
      })}
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

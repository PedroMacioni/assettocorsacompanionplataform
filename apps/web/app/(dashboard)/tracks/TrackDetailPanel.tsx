"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, MapPin, Ruler, Flag, RotateCcw } from "lucide-react";
import { formatDistance, formatLapTime } from "@/lib/format";
import { LapTime } from "@/components/LapTime";
import type { TrackWithStats } from "./TracksGrid";

interface Props {
  track: TrackWithStats;
  onClose: () => void;
}

export function TrackDetailPanel({ track, onClose }: Props) {
  const t = useTranslations("Tracks");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const specItems = [
    track.length_km  && { label: t("modal.length"),    value: `${track.length_km.toFixed(3)} km` },
    track.pitboxes   && { label: t("modal.pitboxes"),  value: String(track.pitboxes) },
    track.run        && { label: t("modal.direction"),  value: track.run },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">

      {/* ── Voltar ────────────────────────────────────────────────────── */}
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {t("detail.back")}
      </button>

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-1">
          {(track.country || track.city) && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {[track.city, track.country].filter(Boolean).join(", ")}
            </p>
          )}
          <h1 className="text-4xl font-bold text-foreground tracking-tight leading-none">{track.name}</h1>
        </div>

        {track.sessions > 0 && (
          <div className="flex items-start gap-8 shrink-0">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                {t("modal.bestLap")}
              </p>
              <p className="text-3xl font-bold font-mono text-primary leading-none">
                <LapTime ms={track.best_lap_ms} />
              </p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                {t("modal.distance")}
              </p>
              <p className="text-3xl font-bold font-mono text-foreground leading-none">
                {formatDistance(track.total_distance_km)}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="w-full h-px bg-border" />

      {/* ── Conteúdo ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Outline da pista */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {track.outline_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.outline_url}
                alt={`${track.name} outline`}
                className="w-full h-64 object-contain bg-muted p-6"
              />
            ) : (
              <div className="w-full h-64 bg-muted flex items-center justify-center">
                <MapPin className="h-16 w-16 text-muted-foreground/20" />
              </div>
            )}

            {track.tags && track.tags.length > 0 && (
              <div className="p-4 flex flex-wrap gap-1.5 border-t border-border">
                {track.tags.slice(0, 10).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-muted border border-border rounded text-[10px] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Specs + stats */}
        <div className="lg:col-span-3 space-y-5">

          {/* Specs */}
          {specItems.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                {t("detail.specs")}
              </p>
              <div className="grid grid-cols-3 gap-4">
                {specItems.map(({ label, value }) => (
                  <div key={label}>
                    <div className="flex items-center gap-1.5 mb-1">
                      {label === t("modal.length")    && <Ruler    className="h-3 w-3 text-muted-foreground" />}
                      {label === t("modal.pitboxes")  && <Flag     className="h-3 w-3 text-muted-foreground" />}
                      {label === t("modal.direction") && <RotateCcw className="h-3 w-3 text-muted-foreground" />}
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {label}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-foreground font-mono">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meus stats */}
          {track.sessions > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                {t("modal.myStats")}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[9px] text-muted-foreground mb-0.5 uppercase tracking-wide">{t("modal.mySessions")}</p>
                  <p className="text-2xl font-bold text-foreground font-mono">{track.sessions}</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground mb-0.5 uppercase tracking-wide">{t("modal.laps")}</p>
                  <p className="text-2xl font-bold text-foreground font-mono">{track.total_laps.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground mb-0.5 uppercase tracking-wide">{t("modal.distance")}</p>
                  <p className="text-2xl font-bold text-foreground font-mono">{formatDistance(track.total_distance_km)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground mb-0.5 uppercase tracking-wide">{t("modal.bestLap")}</p>
                  <p className="text-2xl font-bold text-primary font-mono">
                    {formatLapTime(track.best_lap_ms)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {track.sessions === 0 && (
            <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-center h-32">
              <p className="text-sm text-muted-foreground">{t("card.notYetDriven")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

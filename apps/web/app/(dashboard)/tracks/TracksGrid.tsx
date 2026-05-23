"use client";

import { useState } from "react";
import { slugToName } from "@/lib/format";
import type { Track, TopTrack } from "@/lib/types";
import { LapTime } from "@/components/LapTime";
import { X, MapPin, Ruler, Flag, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type TrackWithStats = Track & {
  sessions: number;
  total_laps: number;
  total_distance_km: number;
  best_lap_ms: number | null;
};

function TrackOutline({ url, name }: { url: string | null; name: string }) {
  if (!url) {
    return (
      <div className="h-36 bg-muted flex items-center justify-center">
        <MapPin className="h-8 w-8 text-muted-foreground/30" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`${name} track outline`}
      className="h-36 w-full object-contain bg-muted p-3"
    />
  );
}

type Translations = {
  length: string;
  pitboxes: string;
  direction: string;
  mySessions: string;
  myStats: string;
  laps: string;
  distance: string;
  bestLap: string;
  sessionOne: string;
  sessionOther: string;
  notYetDriven: string;
};

function TrackModal({
  track,
  onClose,
  tr,
}: {
  track: TrackWithStats;
  onClose: () => void;
  tr: Translations;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-2xl bg-card border border-border rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Outline */}
        {track.outline_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.outline_url}
            alt={`${track.name} outline`}
            className="w-full h-64 object-contain bg-muted p-6"
          />
        ) : (
          <div className="w-full h-40 bg-muted flex items-center justify-center">
            <MapPin className="h-12 w-12 text-muted-foreground/20" />
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* Header */}
          <div>
            {(track.country || track.city) && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                {[track.city, track.country].filter(Boolean).join(", ")}
              </p>
            )}
            <h2 className="text-xl font-bold text-foreground">{track.name}</h2>
          </div>

          {/* Track specs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {track.length_km && (
              <div className="bg-muted rounded-md p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Ruler className="h-3 w-3 text-muted-foreground" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {tr.length}
                  </p>
                </div>
                <p className="text-sm font-bold text-foreground">
                  {track.length_km.toFixed(3)} km
                </p>
              </div>
            )}
            {track.pitboxes && (
              <div className="bg-muted rounded-md p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Flag className="h-3 w-3 text-muted-foreground" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {tr.pitboxes}
                  </p>
                </div>
                <p className="text-sm font-bold text-foreground">{track.pitboxes}</p>
              </div>
            )}
            {track.run && (
              <div className="bg-muted rounded-md p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <RotateCcw className="h-3 w-3 text-muted-foreground" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {tr.direction}
                  </p>
                </div>
                <p className="text-sm font-bold text-foreground">{track.run}</p>
              </div>
            )}
            {track.sessions > 0 && (
              <div className="bg-muted rounded-md p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  {tr.mySessions}
                </p>
                <p className="text-sm font-bold text-foreground">{track.sessions}</p>
              </div>
            )}
          </div>

          {/* User stats */}
          {track.sessions > 0 && (
            <div className="border border-border rounded-md p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                {tr.myStats}
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">{tr.laps}</p>
                  <p className="text-base font-bold text-foreground">
                    {track.total_laps.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">{tr.distance}</p>
                  <p className="text-base font-bold text-foreground">
                    {track.total_distance_km >= 1000
                      ? `${(track.total_distance_km / 1000).toFixed(1)}k km`
                      : `${track.total_distance_km.toFixed(0)} km`}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">{tr.bestLap}</p>
                  <p className="text-base font-bold font-mono text-primary">
                    <LapTime ms={track.best_lap_ms} />
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tags */}
          {track.tags && track.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {track.tags.slice(0, 8).map((tag) => (
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
    </div>
  );
}

export function TracksGrid({
  tracks,
  userStats,
  translations: tr,
}: {
  tracks: Track[];
  userStats: TopTrack[];
  translations: Translations;
}) {
  const [selected, setSelected] = useState<TrackWithStats | null>(null);

  const statsMap = new Map(userStats.map((s) => [s.track_id, s]));

  const tracksWithStats: TrackWithStats[] = tracks.map((t) => {
    const stats = statsMap.get(t.track_id);
    return {
      ...t,
      sessions: stats?.sessions ?? 0,
      total_laps: stats?.total_laps ?? 0,
      total_distance_km: stats?.total_distance_km ?? 0,
      best_lap_ms: stats?.best_lap_ms ?? null,
    };
  });

  // Sort: tracks with sessions first, then alphabetically
  const sorted = [...tracksWithStats].sort((a, b) => {
    if (a.sessions !== b.sessions) return b.sessions - a.sessions;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((track) => (
          <button
            key={track.track_id}
            onClick={() => setSelected(track)}
            className={cn(
              "text-left bg-card border border-border rounded-md overflow-hidden",
              "hover:border-primary/40 transition-all duration-150 group"
            )}
          >
            <TrackOutline url={track.outline_url} name={track.name} />
            <div className="p-4">
              {(track.country || track.city) && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  {[track.city, track.country].filter(Boolean).join(", ")}
                </p>
              )}
              <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                {track.name}
              </p>
              <div className="flex items-center gap-4 mt-2">
                {track.length_km && (
                  <span className="text-[11px] text-muted-foreground">
                    {track.length_km.toFixed(3)} km
                  </span>
                )}
                {track.sessions > 0 ? (
                  <span className="text-[11px] text-primary font-medium">
                    {track.sessions} {track.sessions === 1 ? tr.sessionOne : tr.sessionOther}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground/50">{tr.notYetDriven}</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <TrackModal track={selected} onClose={() => setSelected(null)} tr={tr} />
      )}
    </>
  );
}

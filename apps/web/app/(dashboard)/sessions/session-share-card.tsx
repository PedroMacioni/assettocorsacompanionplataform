"use client";

import { forwardRef } from "react";
import { Trophy, Timer, Hash, Flag } from "lucide-react";
import { formatLapTime, formatDelta, slugToName } from "@/lib/format";
import type { SessionBadge } from "@/lib/types";
import { cn } from "@/lib/utils";

type Sectors = {
  s1_ms: number | null;
  s2_ms: number | null;
  s3_ms: number | null;
};

type Props = {
  carId: string;
  trackId: string;
  bestLapMs: number | null;
  deltaPbMs: number | null;
  date: string;
  badge: SessionBadge;
  sessionType?: string | null;
  lapsCount?: number | null;
  sectors?: Sectors | null;
};

function SectorBar({ label, ms, totalMs }: { label: string; ms: number | null; totalMs: number | null }) {
  if (!ms || !totalMs) return null;
  const pct = Math.min(100, (ms / totalMs) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 shrink-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-primary/80 to-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-zinc-300">
        {formatLapTime(ms)}
      </span>
    </div>
  );
}

export const SessionShareCard = forwardRef<HTMLDivElement, Props>(
  function SessionShareCard(
    { carId, trackId, bestLapMs, deltaPbMs, date, badge, sessionType, lapsCount, sectors },
    ref
  ) {
    const formattedDate = new Date(date).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const hasSectors =
      sectors && (sectors.s1_ms || sectors.s2_ms || sectors.s3_ms);

    return (
      <div
        ref={ref}
        className="w-[400px] rounded-xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-6 text-white"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        {/* Header badges */}
        <div className="mb-4 flex items-center gap-2">
          {badge === "new_pb" && (
            <div className="flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2 py-1 ring-1 ring-amber-500/30">
              <Trophy className="size-3.5 text-amber-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                New Personal Best
              </span>
            </div>
          )}
          {sessionType && (
            <div className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-2 py-1">
              <Flag className="size-3 text-zinc-400" />
              <span className="text-[11px] font-semibold capitalize text-zinc-400">
                {sessionType.toLowerCase().replace("_", " ")}
              </span>
            </div>
          )}
        </div>

        {/* Car and track */}
        <h3 className="text-2xl font-bold leading-tight text-white">
          {slugToName(carId)}
        </h3>
        <p className="mt-0.5 text-sm text-zinc-400">{slugToName(trackId)}</p>

        {/* Best lap time */}
        <div className="mt-5 flex items-baseline gap-3">
          <div className="flex items-center gap-2">
            <Timer className="size-4 text-zinc-500" />
            <span className="font-mono text-4xl font-bold tabular-nums text-white">
              {formatLapTime(bestLapMs)}
            </span>
          </div>
          {deltaPbMs !== null && deltaPbMs !== 0 && (
            <span
              className={cn(
                "font-mono text-lg font-semibold tabular-nums",
                deltaPbMs < 0 ? "text-emerald-400" : "text-orange-400"
              )}
            >
              {formatDelta(deltaPbMs)}
            </span>
          )}
        </div>

        {/* Sectors */}
        {hasSectors && (
          <div className="mt-5 space-y-2 rounded-lg bg-zinc-800/50 p-3">
            <SectorBar label="S1" ms={sectors!.s1_ms} totalMs={bestLapMs} />
            <SectorBar label="S2" ms={sectors!.s2_ms} totalMs={bestLapMs} />
            <SectorBar label="S3" ms={sectors!.s3_ms} totalMs={bestLapMs} />
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-4">
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>{formattedDate}</span>
            {lapsCount != null && lapsCount > 0 && (
              <div className="flex items-center gap-1">
                <Hash className="size-3" />
                <span>{lapsCount} laps</span>
              </div>
            )}
          </div>
          <span className="text-xs font-semibold text-zinc-500">apexcompanion.com</span>
        </div>
      </div>
    );
  }
);

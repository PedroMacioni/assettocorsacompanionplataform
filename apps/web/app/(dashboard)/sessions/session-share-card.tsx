"use client";

import { forwardRef } from "react";
import { Trophy } from "lucide-react";
import { formatLapTime, formatDelta, slugToName } from "@/lib/format";
import type { SessionBadge } from "@/lib/types";

type Props = {
  carId: string;
  trackId: string;
  bestLapMs: number | null;
  deltaPbMs: number | null;
  date: string;
  badge: SessionBadge;
};

export const SessionShareCard = forwardRef<HTMLDivElement, Props>(
  function SessionShareCard({ carId, trackId, bestLapMs, deltaPbMs, date, badge }, ref) {
    const formattedDate = new Date(date).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return (
      <div
        ref={ref}
        className="w-[400px] rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 text-white"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        {badge === "new_pb" && (
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="size-5 text-amber-400" />
            <span className="text-sm font-bold uppercase tracking-wider text-amber-400">
              New Personal Best
            </span>
          </div>
        )}

        <h3 className="text-2xl font-bold text-white">{slugToName(carId)}</h3>
        <p className="mt-1 text-base text-zinc-400">{slugToName(trackId)}</p>

        <div className="mt-6 flex items-baseline gap-4">
          <span className="font-mono text-4xl font-bold tabular-nums text-white">
            {formatLapTime(bestLapMs)}
          </span>
          {deltaPbMs !== null && deltaPbMs !== 0 && (
            <span
              className={`font-mono text-xl font-semibold tabular-nums ${
                deltaPbMs < 0 ? "text-emerald-400" : "text-orange-400"
              }`}
            >
              {formatDelta(deltaPbMs)}
            </span>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4">
          <span className="text-sm text-zinc-500">{formattedDate}</span>
          <span className="text-sm font-medium text-zinc-400">apexcompanion.com</span>
        </div>
      </div>
    );
  }
);

"use client";

import { forwardRef } from "react";
import { Trophy, Timer, Hash, Flag } from "lucide-react";
import { formatLapTime, formatDelta, slugToName } from "@/lib/format";
import type { SessionBadge } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ShareCardTheme = "dark" | "light";

type BestLapSplit = {
  lap_number: number | null;
  time_ms: number | null;
  s1_ms: number | null;
  s2_ms: number | null;
  s3_ms: number | null;
  tyre: string | null;
};

type Labels = {
  newPb: string;
  bestLapSectors: string;
  lap: string;
  tyre: string;
  lapsText: string;
};

type Props = {
  theme: ShareCardTheme;
  locale: string;
  carId: string;
  trackId: string;
  bestLapMs: number | null;
  deltaPbMs: number | null;
  date: string;
  badge: SessionBadge;
  sessionType?: string | null;
  lapsCount?: number | null;
  bestLap?: BestLapSplit | null;
  labels: Labels;
};

function formatSector(ms: number | null | undefined) {
  if (!ms || ms <= 0) return "-";
  const seconds = Math.floor(ms / 1000);
  const millis = ms % 1000;
  return `${seconds}.${String(millis).padStart(3, "0")}`;
}

function SectorTime({
  label,
  ms,
  tone,
  theme,
}: {
  label: string;
  ms: number | null;
  tone: "purple" | "green" | "yellow";
  theme: ShareCardTheme;
}) {
  const isLight = theme === "light";
  const toneClass = {
    purple: {
      dot: isLight ? "bg-purple-600" : "bg-purple-400",
      text: isLight ? "text-purple-700" : "text-purple-300",
    },
    green: {
      dot: isLight ? "bg-green-600" : "bg-green-400",
      text: isLight ? "text-green-700" : "text-green-300",
    },
    yellow: {
      dot: isLight ? "bg-yellow-600" : "bg-yellow-400",
      text: isLight ? "text-yellow-700" : "text-yellow-300",
    },
  }[tone];

  return (
    <div
      className={cn(
        "min-w-0 rounded-md border px-3 py-2.5",
        isLight ? "border-zinc-200 bg-white/80" : "border-zinc-800 bg-zinc-950/45"
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn("size-1.5 rounded-full", toneClass.dot)} />
        <span className={cn("text-[10px] font-bold uppercase tracking-widest", toneClass.text)}>
          {label}
        </span>
      </div>
      <p
        className={cn(
          "mt-1 font-mono text-lg font-semibold leading-none tabular-nums",
          isLight ? "text-zinc-950" : "text-white"
        )}
      >
        {formatSector(ms)}
      </p>
    </div>
  );
}

export const SessionShareCard = forwardRef<HTMLDivElement, Props>(
  function SessionShareCard(
    {
      theme,
      locale,
      carId,
      trackId,
      bestLapMs,
      deltaPbMs,
      date,
      badge,
      sessionType,
      lapsCount,
      bestLap,
      labels,
    },
    ref
  ) {
    const formattedDate = new Date(date).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const hasSectors =
      bestLap && (bestLap.s1_ms || bestLap.s2_ms || bestLap.s3_ms);
    const isLight = theme === "light";

    return (
      <div
        ref={ref}
        className={cn(
          "w-[400px] rounded-xl p-6",
          isLight
            ? "bg-gradient-to-br from-white via-zinc-50 to-zinc-100 text-zinc-950 shadow-sm ring-1 ring-zinc-200"
            : "bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 text-white"
        )}
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        {/* Header badges */}
        <div className="mb-4 flex items-center gap-2">
          {badge === "new_pb" && (
            <div className="flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2 py-1 ring-1 ring-amber-500/30">
              <Trophy className="size-3.5 text-amber-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                {labels.newPb}
              </span>
            </div>
          )}
          {sessionType && (
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1",
                isLight ? "bg-zinc-100" : "bg-zinc-800"
              )}
            >
              <Flag className={cn("size-3", isLight ? "text-zinc-500" : "text-zinc-400")} />
              <span
                className={cn(
                  "text-[11px] font-semibold capitalize",
                  isLight ? "text-zinc-600" : "text-zinc-400"
                )}
              >
                {sessionType.toLowerCase().replace("_", " ")}
              </span>
            </div>
          )}
        </div>

        {/* Car and track */}
        <h3 className={cn("text-2xl font-bold leading-tight", isLight ? "text-zinc-950" : "text-white")}>
          {slugToName(carId)}
        </h3>
        <p className={cn("mt-0.5 text-sm", isLight ? "text-zinc-600" : "text-zinc-400")}>
          {slugToName(trackId)}
        </p>

        {/* Best lap time */}
        <div className="mt-5 flex items-baseline gap-3">
          <div className="flex items-center gap-2">
            <Timer className={cn("size-4", isLight ? "text-zinc-500" : "text-zinc-500")} />
            <span
              className={cn(
                "font-mono text-4xl font-bold tabular-nums",
                isLight ? "text-zinc-950" : "text-white"
              )}
            >
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

        {/* Best lap sectors */}
        {hasSectors && (
          <div
            className={cn(
              "mt-5 rounded-lg border p-3.5",
              isLight ? "border-zinc-200 bg-zinc-50/80" : "border-zinc-800 bg-zinc-900/45"
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-widest",
                  isLight ? "text-zinc-500" : "text-zinc-500"
                )}
              >
                {labels.bestLapSectors}
              </span>
              <div
                className={cn(
                  "flex shrink-0 items-center gap-2 text-[10px] font-medium uppercase tracking-wider",
                  isLight ? "text-zinc-500" : "text-zinc-500"
                )}
              >
                {bestLap!.lap_number !== null && (
                  <span>
                    {labels.lap} {bestLap!.lap_number + 1}
                  </span>
                )}
                {bestLap!.tyre && (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5",
                      isLight ? "bg-white text-zinc-700 ring-1 ring-zinc-200" : "bg-zinc-800 text-zinc-300"
                    )}
                  >
                    {labels.tyre} {bestLap!.tyre.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <SectorTime label="S1" ms={bestLap!.s1_ms} tone="purple" theme={theme} />
              <SectorTime label="S2" ms={bestLap!.s2_ms} tone="green" theme={theme} />
              <SectorTime label="S3" ms={bestLap!.s3_ms} tone="yellow" theme={theme} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          className={cn(
            "mt-5 flex items-center justify-between border-t pt-4",
            isLight ? "border-zinc-200" : "border-zinc-800"
          )}
        >
          <div className={cn("flex items-center gap-3 text-xs", isLight ? "text-zinc-500" : "text-zinc-500")}>
            <span>{formattedDate}</span>
            {lapsCount != null && lapsCount > 0 && (
              <div className="flex items-center gap-1">
                <Hash className="size-3" />
                <span>{labels.lapsText}</span>
              </div>
            )}
          </div>
          <span className={cn("text-xs font-semibold", isLight ? "text-zinc-500" : "text-zinc-500")}>
            apexcompanion.com
          </span>
        </div>
      </div>
    );
  }
);

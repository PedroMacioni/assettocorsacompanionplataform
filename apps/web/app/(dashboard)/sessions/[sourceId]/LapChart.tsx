"use client";

import { useMemo } from "react";
import { formatLapTime } from "@/lib/format";
import type { Lap } from "@/lib/types";

const PURPLE = "#c084fc";
const GREEN  = "#4ade80";
const YELLOW = "#facc15";
const RED    = "#f87171";
const GREY   = "rgba(107,114,128,0.2)";

interface Props {
  laps: Lap[];
  bestLapMs: number | null;
}

export function LapChart({ laps, bestLapMs }: Props) {
  const layout = useMemo(() => {
    if (!laps.length) return null;

    const W = 800;
    const H = 160;
    const PAD = { top: 10, right: 12, bottom: 26, left: 72 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    const validTimes = laps
      .filter((l) => l.cuts === 0 && l.time_ms > 0)
      .map((l) => l.time_ms)
      .sort((a, b) => a - b);

    const refTime =
      bestLapMs ??
      (validTimes.length ? validTimes[0] : null) ??
      laps.filter((l) => l.time_ms > 0).reduce((m, l) => Math.min(m, l.time_ms), Infinity);

    // Filter out pit-stop outliers (> 3× best)
    const threshold = isFinite(refTime) ? refTime * 3 : Infinity;

    const displayedTimes = laps
      .filter((l) => l.time_ms > 0 && l.time_ms < threshold)
      .map((l) => l.time_ms);

    if (!displayedTimes.length) return null;

    const p25 = validTimes[Math.floor(validTimes.length * 0.25)] ?? Infinity;
    const p75 = validTimes[Math.floor(validTimes.length * 0.75)] ?? Infinity;

    const yMin = Math.min(...displayedTimes) * 0.9975;
    const yMax = Math.max(...displayedTimes) * 1.0025;
    const range = yMax - yMin;
    if (range < 1) return null;

    const n = laps.length;
    const barSpacing = chartW / n;
    const barW = Math.max(2, Math.min(16, barSpacing * 0.72));

    const bars = laps.map((lap, i) => {
      const cx = PAD.left + i * barSpacing + (barSpacing - barW) / 2;
      if (!lap.time_ms || lap.time_ms <= 0 || lap.time_ms >= threshold) {
        return { cx, barW, y: PAD.top + chartH, h: 0, color: GREY, lapNum: lap.lap_number + 1, skip: true };
      }
      const y = PAD.top + chartH - ((lap.time_ms - yMin) / range) * chartH;
      const h = PAD.top + chartH - y;
      let color: string;
      if (lap.cuts > 0) {
        color = GREY;
      } else if (bestLapMs !== null && lap.time_ms === bestLapMs) {
        color = PURPLE;
      } else if (lap.time_ms <= p25) {
        color = GREEN;
      } else if (lap.time_ms <= p75) {
        color = YELLOW;
      } else {
        color = RED;
      }
      return { cx, barW, y, h, color, lapNum: lap.lap_number + 1, skip: false };
    });

    const refLineY =
      bestLapMs !== null && isFinite(refTime)
        ? PAD.top + chartH - ((bestLapMs - yMin) / range) * chartH
        : null;

    const tickStep = Math.max(1, Math.ceil(n / 10));

    return { W, H, PAD, chartH, bars, refLineY, tickStep, bestLapMs };
  }, [laps, bestLapMs]);

  if (!layout) {
    return (
      <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
        Sem dados suficientes
      </div>
    );
  }

  const { W, H, PAD, chartH, bars, refLineY, tickStep } = layout;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto select-none"
    >
      {/* Axis lines */}
      <line
        x1={PAD.left} y1={PAD.top}
        x2={PAD.left} y2={PAD.top + chartH}
        stroke="currentColor" strokeOpacity="0.08" strokeWidth="1"
      />
      <line
        x1={PAD.left} y1={PAD.top + chartH}
        x2={W - PAD.right} y2={PAD.top + chartH}
        stroke="currentColor" strokeOpacity="0.08" strokeWidth="1"
      />

      {/* Best lap reference line */}
      {refLineY !== null && (
        <>
          <line
            x1={PAD.left} y1={refLineY}
            x2={W - PAD.right} y2={refLineY}
            stroke={PURPLE} strokeWidth="1.5" strokeDasharray="5,4" strokeOpacity="0.75"
          />
          <text
            x={PAD.left - 5} y={refLineY + 3.5}
            textAnchor="end" fontSize="9.5"
            fill={PURPLE} fillOpacity="0.9"
          >
            {formatLapTime(layout.bestLapMs)}
          </text>
        </>
      )}

      {/* Bars */}
      {bars.map((b, i) =>
        b.skip ? null : (
          <rect key={i} x={b.cx} y={b.y} width={b.barW} height={b.h} fill={b.color} rx="1.5" />
        ),
      )}

      {/* X axis lap number labels */}
      {bars.map((b, i) =>
        i % tickStep === 0 || i === bars.length - 1 ? (
          <text
            key={`xl-${i}`}
            x={b.cx + b.barW / 2} y={H - 3}
            textAnchor="middle" fontSize="9"
            fill="currentColor" fillOpacity="0.38"
          >
            {b.lapNum}
          </text>
        ) : null,
      )}
    </svg>
  );
}

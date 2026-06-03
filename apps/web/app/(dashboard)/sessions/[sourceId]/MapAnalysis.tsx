"use client";

import { useState } from "react";
import type { LapTelemetry } from "@/lib/types";
import { TrackMap } from "./TrackMap";
import { TelemetryTrace } from "./TelemetryTrace";

interface Props {
  telemetry: LapTelemetry;
  bestS1: number | null;
  bestS2: number | null;
  bestS3: number | null;
  consistData: { score: number; labelKey: string; barColor: string } | null;
  theoretical: number | null;
}

export function MapAnalysis({
  telemetry,
  bestS1,
  bestS2,
  bestS3,
}: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [mode, setMode] = useState<"speed" | "throttle" | "brake">("speed");

  const { data } = telemetry;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Left: Track Map (larger) */}
        <div className="flex-1 min-w-0">
          <TrackMap
            telemetry={telemetry}
            bestS1={bestS1}
            bestS2={bestS2}
            bestS3={bestS3}
            hoverIdx={hoverIdx}
            onHover={setHoverIdx}
            mode={mode}
            onModeChange={setMode}
          />
        </div>

        {/* Right: Stats Panel placeholder */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="h-full rounded-lg bg-muted/20 border border-border/50 p-4 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Painel de métricas</p>
          </div>
        </div>
      </div>

      {/* Bottom: Telemetry Trace with synchronized hover */}
      <div className="mt-4">
        <TelemetryTrace
          points={data.p}
          maxSpeed={data.mv}
          sectorBoundaries={data.s}
          hoverIdx={hoverIdx}
          onHover={setHoverIdx}
        />
      </div>
    </div>
  );
}

"use client";

import type { LapTelemetry } from "@/lib/types";
import { TrackMap } from "./TrackMap";

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
  // Estado de hover e mode será lifted quando TrackMap for atualizado na Fase 3
  // Por enquanto, TrackMap gerencia internamente

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
          />
        </div>

        {/* Right: Stats Panel placeholder */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="h-full rounded-lg bg-muted/20 border border-border/50 p-4 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Painel de métricas</p>
          </div>
        </div>
      </div>

      {/* Bottom: Telemetry Trace placeholder */}
      <div className="mt-4 h-32 rounded-lg bg-muted/20 border border-border/50 flex items-center justify-center">
        <p className="text-xs text-muted-foreground">Trace de telemetria</p>
      </div>
    </div>
  );
}

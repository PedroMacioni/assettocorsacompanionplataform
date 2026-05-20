import Link from "next/link";
import { PaceChartClient } from "@/components/charts/PaceChartClient";

interface PaceEvolutionCardProps {
  data: Array<Record<string, unknown>>;
  tracks: string[];
  trackLabels: Record<string, string>;
}

export function PaceEvolutionCard({ data, tracks, trackLabels }: PaceEvolutionCardProps) {
  const hasData = data.length > 0 && tracks.length > 0;

  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6b6b72] mb-1">
            Evolução de Pace
          </p>
          <p className="text-sm text-white font-medium">
            Melhor volta — últimas 4 semanas
          </p>
        </div>
        <Link
          href="/analytics?tab=pace"
          className="text-xs text-[#6b6b72] hover:text-[#e8612a] uppercase tracking-wider transition-colors"
        >
          Ver análise →
        </Link>
      </div>

      {hasData ? (
        <div className="h-[180px]">
          <PaceChartClient data={data} tracks={tracks} trackLabels={trackLabels} />
        </div>
      ) : (
        <div className="h-[180px] flex items-center justify-center">
          <p className="text-sm text-[#6b6b72]">Dados insuficientes</p>
        </div>
      )}

      {/* Inline legend */}
      {hasData && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#2a2a2c]">
          {tracks.map((track, i) => {
            const colors = ["#e8612a", "#22c55e", "#3b82f6"];
            return (
              <div key={track} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: colors[i] }}
                />
                <span className="text-xs text-[#6b6b72]">{trackLabels[track]}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

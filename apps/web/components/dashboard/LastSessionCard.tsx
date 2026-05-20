import Link from "next/link";
import { formatLapTime, slugToName } from "@/lib/format";
import { SessionQualityBadge } from "./SessionQualityBadge";
import type { SessionQualityBadge as BadgeType } from "@/lib/calculations";

interface LastSessionCardProps {
  session: {
    id: string;
    track_id: string;
    car_id: string;
    best_lap_ms: number | null;
    laps: number;
    started_at: string;
    session_types: string | null;
  };
  qualityBadge: BadgeType;
  pbTime?: number | null;
  pbDelta?: number | null; // ms, negative = improved
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d atrás`;
  if (hrs > 0) return `${hrs}h atrás`;
  if (mins > 0) return `${mins}m atrás`;
  return "agora";
}

function formatDeltaMs(ms: number): string {
  const sign = ms < 0 ? "" : "+";
  return `${sign}${(ms / 1000).toFixed(3)}s`;
}

export function LastSessionCard({
  session,
  qualityBadge,
  pbTime,
  pbDelta,
}: LastSessionCardProps) {
  return (
    <Link
      href={`/sessions/${session.id}`}
      className="block bg-[#161618] border border-[#2a2a2c] rounded-md p-5 transition-all duration-150 hover:border-[#e8612a] hover:shadow-lg hover:shadow-[#e8612a15] hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#6b6b72]">
          Última Sessão
        </p>
        <SessionQualityBadge badge={qualityBadge} size="sm" />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white leading-tight">
            {slugToName(session.track_id)}
          </h3>
          <p className="text-sm text-[#6b6b72] mt-1">
            {slugToName(session.car_id)}
          </p>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-[#6b6b72] mt-3">
            <span>{session.laps} voltas</span>
            {session.session_types && (
              <>
                <span>·</span>
                <span>{session.session_types}</span>
              </>
            )}
            <span>·</span>
            <span>{timeAgo(session.started_at)}</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-3xl font-bold text-white font-mono">
            {formatLapTime(session.best_lap_ms)}
          </p>
          {pbDelta !== null && pbDelta !== undefined && (
            <p
              className={`text-sm font-medium mt-1 ${
                pbDelta <= 0 ? "text-[#22c55e]" : "text-[#ef4444]"
              }`}
            >
              {formatDeltaMs(pbDelta)} vs PB
            </p>
          )}
        </div>
      </div>

      {/* Progress bar vs PB */}
      {pbTime && session.best_lap_ms && (
        <div className="mt-5">
          <div className="flex justify-between text-[10px] text-[#6b6b72] mb-1.5 uppercase tracking-wider">
            <span>vs Personal Best</span>
            <span className="font-mono">{formatLapTime(pbTime)}</span>
          </div>
          <div className="h-1.5 bg-[#1e1e20] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                session.best_lap_ms <= pbTime ? "bg-[#22c55e]" : "bg-[#e8612a]"
              }`}
              style={{
                width: `${Math.min(100, (pbTime / session.best_lap_ms) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </Link>
  );
}

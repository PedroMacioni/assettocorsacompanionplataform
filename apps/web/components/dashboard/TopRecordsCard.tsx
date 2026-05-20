import Link from "next/link";
import { formatLapTime, slugToName } from "@/lib/format";
import { Star } from "lucide-react";

interface PersonalBest {
  id: string;
  car_id: string;
  track_id: string;
  time_ms: number;
}

interface TopRecordsCardProps {
  records: PersonalBest[];
}

export function TopRecordsCard({ records }: TopRecordsCardProps) {
  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#6b6b72] mb-4">
        Top Records
      </p>

      {records.length > 0 ? (
        <div className="space-y-4">
          {records.map((pb, i) => (
            <div
              key={pb.id}
              className="flex items-center gap-3 p-2 -mx-2 rounded-md transition-colors hover:bg-[#1e1e20]"
            >
              {/* Position indicator */}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0
                    ? "bg-[#e8612a20] text-[#e8612a]"
                    : "bg-[#2a2a2c] text-[#6b6b72]"
                }`}
              >
                {i + 1}
              </div>

              {/* Track and car info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">
                  {slugToName(pb.track_id)}
                </p>
                <p className="text-xs text-[#6b6b72] truncate">
                  {slugToName(pb.car_id)}
                </p>
              </div>

              {/* Time */}
              <div className="flex items-center gap-1.5 shrink-0">
                {i === 0 && (
                  <Star className="w-3.5 h-3.5 text-[#e8612a] fill-[#e8612a]" />
                )}
                <p
                  className={`text-sm font-bold font-mono ${
                    i === 0 ? "text-[#e8612a]" : "text-white"
                  }`}
                >
                  {formatLapTime(pb.time_ms)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#6b6b72]">Nenhum record ainda</p>
      )}

      <Link
        href="/personal-bests"
        className="mt-4 block text-xs text-[#6b6b72] hover:text-[#e8612a] uppercase tracking-wider transition-colors"
      >
        Ver todos →
      </Link>
    </div>
  );
}

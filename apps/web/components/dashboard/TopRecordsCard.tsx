import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatLapTime, slugToName } from "@/lib/format";
import { Star, ExternalLink } from "lucide-react";

interface PersonalBest {
  id: string;
  car_id: string;
  track_id: string;
  time_ms: number;
}

interface TopRecordsCardProps {
  records: PersonalBest[];
}

export async function TopRecordsCard({ records }: TopRecordsCardProps) {
  const t = await getTranslations("PersonalRecords");

  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#6b6b72] mb-4">
        {t("title")}
      </p>

      {records.length > 0 ? (
        <div className="space-y-4">
          {records.map((pb, i) => (
            <Link
              key={pb.id}
              href={`/sessions?track=${pb.track_id}&car=${pb.car_id}`}
              className="flex items-center gap-3 p-2 -mx-2 rounded-md transition-colors hover:bg-[#1e1e20] group"
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0
                    ? "bg-[#e8612a20] text-[#e8612a]"
                    : "bg-[#2a2a2c] text-[#6b6b72]"
                }`}
              >
                {i + 1}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">
                  {slugToName(pb.track_id)}
                </p>
                <p className="text-xs text-[#6b6b72] truncate">
                  {slugToName(pb.car_id)}
                </p>
              </div>

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
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#6b6b72]">{t("empty")}</p>
      )}

      <Link
        href="/analytics?tab=records"
        className="mt-5 flex items-center gap-1.5 text-xs text-[#6b6b72] hover:text-[#e8612a] uppercase tracking-wider transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        {t("viewAll")}
      </Link>
    </div>
  );
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatLapTime, slugToName } from "@/lib/format";
import { ExternalLink } from "lucide-react";

interface PersonalBest {
  id: string;
  car_id: string;
  track_id: string;
  time_ms: number;
  synced_at: string;
}

interface RecentRecordsCardProps {
  records: PersonalBest[];
}

export async function RecentRecordsCard({ records }: RecentRecordsCardProps) {
  const t = await getTranslations("RecentRecords");
  const tCommon = await getTranslations("Common");

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return tCommon("timeAgo.daysAgo", { count: days });
    if (hrs > 0) return tCommon("timeAgo.hoursAgo", { count: hrs });
    if (mins > 0) return tCommon("timeAgo.minutesAgo", { count: mins });
    return tCommon("timeAgo.now");
  }

  return (
    <div className="bg-card border border-border rounded-md p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("title")}
        </p>
        <Link
          href="/personal-bests"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary uppercase tracking-wider transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          {t("viewAll")}
        </Link>
      </div>

      {records.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {records.map((pb, i) => (
            <div
              key={pb.id}
              className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${
                i === 0
                  ? "border-primary/25 bg-primary/[0.03]"
                  : "border-border hover:border-border/80"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {slugToName(pb.track_id)}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {slugToName(pb.car_id)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`text-sm font-bold font-mono ${
                    i === 0 ? "text-primary" : "text-foreground"
                  }`}
                >
                  {formatLapTime(pb.time_ms)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {timeAgo(pb.synced_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}
    </div>
  );
}

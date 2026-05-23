import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatLapTime, slugToName } from "@/lib/format";
import { SessionQualityBadge } from "./SessionQualityBadge";
import type { SessionQualityBadge as BadgeType } from "@/lib/calculations";
import { ExternalLink } from "lucide-react";

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
  pbDelta?: number | null;
}

function formatDeltaMs(ms: number): string {
  const sign = ms < 0 ? "" : "+";
  return `${sign}${(ms / 1000).toFixed(3)}s`;
}

export async function LastSessionCard({ session, qualityBadge, pbTime, pbDelta }: LastSessionCardProps) {
  const t = await getTranslations("LastSession");
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

  const badgeTypeKey = qualityBadge.type as "pb" | "improving" | "consistent" | "warmup";
  const translatedBadge = { ...qualityBadge, label: t(`badge.${badgeTypeKey}`) };

  return (
    <div className="bg-card border border-border rounded-md p-5 transition-all duration-150 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("title")}
        </p>
        <SessionQualityBadge badge={translatedBadge} size="sm" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-foreground leading-tight truncate">
            {slugToName(session.track_id)}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 truncate">{slugToName(session.car_id)}</p>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-3">
            <span>{t("lapsCount", { count: session.laps })}</span>
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

        <div className="sm:text-right shrink-0">
          <p className="text-2xl sm:text-3xl font-bold text-foreground font-mono">
            {formatLapTime(session.best_lap_ms)}
          </p>
          {pbDelta !== null && pbDelta !== undefined && (
            <p className={`text-sm font-medium mt-1 ${pbDelta <= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatDeltaMs(pbDelta)} {t("vsPb")}
            </p>
          )}
        </div>
      </div>

      {pbTime && session.best_lap_ms && (
        <div className="mt-5">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">
            <span>{t("vsPersonalBest")}</span>
            <span className="font-mono">{formatLapTime(pbTime)}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${session.best_lap_ms <= pbTime ? "bg-green-500" : "bg-primary"}`}
              style={{ width: `${Math.min(100, (pbTime / session.best_lap_ms) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/sessions/${session.id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          {tCommon("openSession")}
        </Link>
        <Link
          href="/sessions"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary uppercase tracking-wider transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          {t("allSessions")}
        </Link>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { getConsistencyLevel } from "@/lib/calculations";
import { Flame, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface HeroCardProps {
  streak: { current: number; record: number };
  consistency: { score: number; trend: "up" | "down" | "stable" };
  weeklyDigest: { laps: number; sessions: number; pbsBeaten: number; deltaVsLastWeek: number };
}

export function HeroCard({ streak, consistency, weeklyDigest }: HeroCardProps) {
  const t = useTranslations("HeroCard");
  const tCommon = useTranslations("Common");
  const consistencyLevel = getConsistencyLevel(consistency.score);

  const TrendIcon = { up: TrendingUp, down: TrendingDown, stable: Minus }[consistency.trend];

  return (
    <div className="bg-card border border-border rounded-xl p-6 transition-all duration-150 hover:shadow-lg hover:shadow-primary/5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Streak */}
        <div className="flex flex-col items-center justify-center text-center p-4 rounded-lg bg-muted">
          <div className="flex items-center gap-2 mb-2">
            <Flame className={`w-5 h-5 ${streak.current > 0 ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("streak")}
            </span>
          </div>
          <p className="text-5xl font-bold text-foreground mb-1">{streak.current}</p>
          <p className="text-sm text-muted-foreground">
            {streak.current === 1 ? tCommon("day") : tCommon("days")}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {t("streakRecord", { record: streak.record })}
          </p>
        </div>

        {/* Consistency Score */}
        <div className="flex flex-col items-center justify-center text-center p-4 rounded-lg bg-muted">
          <div className="flex items-center gap-2 mb-2">
            <TrendIcon
              className={`w-4 h-4 ${
                consistency.trend === "up" ? "text-green-500" : consistency.trend === "down" ? "text-red-500" : "text-muted-foreground"
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("consistency")}
            </span>
          </div>
          <p className="text-5xl font-bold text-foreground mb-1">{consistency.score}</p>
          <p className="text-sm" style={{ color: consistencyLevel.color }}>/100</p>
          <div className="w-full mt-3">
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${consistency.score}%`, backgroundColor: consistencyLevel.color }}
              />
            </div>
            <p className="text-xs mt-1.5 font-medium" style={{ color: consistencyLevel.color }}>
              {consistencyLevel.label}
            </p>
          </div>
        </div>

        {/* Weekly Digest */}
        <div className="flex flex-col items-center justify-center text-center p-4 rounded-lg bg-muted">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {t("thisWeek")}
          </span>
          <div className="space-y-1.5">
            <p className="text-2xl font-bold text-foreground">
              {weeklyDigest.laps.toLocaleString()}{" "}
              <span className="text-sm font-normal text-muted-foreground">{tCommon("laps")}</span>
            </p>
            <p className="text-lg text-muted-foreground">
              {weeklyDigest.sessions}{" "}
              <span className="text-sm">
                {weeklyDigest.sessions === 1 ? "sessão" : tCommon("sessions")}
              </span>
            </p>
            {weeklyDigest.pbsBeaten > 0 && (
              <p className="text-sm text-yellow-500 font-medium">
                🏆 {t("pbsBeaten", { count: weeklyDigest.pbsBeaten })}
              </p>
            )}
          </div>
          {weeklyDigest.deltaVsLastWeek !== 0 && (
            <p className={`text-xs mt-3 ${weeklyDigest.deltaVsLastWeek > 0 ? "text-green-500" : "text-red-500"}`}>
              {weeklyDigest.deltaVsLastWeek > 0 ? "+" : ""}
              {t("vsLastWeek", { delta: weeklyDigest.deltaVsLastWeek.toFixed(0) })}
            </p>
          )}
          <Link
            href="/sessions?filter=this_week"
            className="mt-4 text-xs text-muted-foreground hover:text-primary uppercase tracking-wider transition-colors"
          >
            {t("viewWeekSessions")} →
          </Link>
        </div>
      </div>
    </div>
  );
}

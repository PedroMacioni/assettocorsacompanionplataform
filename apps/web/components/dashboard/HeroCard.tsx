"use client";

import { getConsistencyLevel } from "@/lib/calculations";
import { Flame, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface HeroCardProps {
  streak: {
    current: number;
    record: number;
  };
  consistency: {
    score: number;
    trend: "up" | "down" | "stable";
  };
  weeklyDigest: {
    laps: number;
    sessions: number;
    pbsBeaten: number;
    deltaVsLastWeek: number; // percentage
  };
}

export function HeroCard({ streak, consistency, weeklyDigest }: HeroCardProps) {
  const consistencyLevel = getConsistencyLevel(consistency.score);

  const TrendIcon = {
    up: TrendingUp,
    down: TrendingDown,
    stable: Minus,
  }[consistency.trend];

  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-xl p-6 transition-all duration-150 hover:shadow-lg hover:shadow-[#e8612a10]">
      <div className="grid grid-cols-3 gap-6">
        {/* Streak Block */}
        <div className="flex flex-col items-center justify-center text-center p-4 rounded-lg bg-[#1e1e20]">
          <div className="flex items-center gap-2 mb-2">
            <Flame
              className={`w-5 h-5 ${
                streak.current > 0 ? "text-[#e8612a] animate-pulse" : "text-[#6b6b72]"
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#6b6b72]">
              Streak
            </span>
          </div>
          <p className="text-5xl font-bold text-white mb-1">{streak.current}</p>
          <p className="text-sm text-[#6b6b72]">
            {streak.current === 1 ? "dia" : "dias"}
          </p>
          <p className="text-xs text-[#6b6b72] mt-2">
            Recorde: <span className="text-white font-medium">{streak.record}</span>
          </p>
        </div>

        {/* Consistency Score Block */}
        <div className="flex flex-col items-center justify-center text-center p-4 rounded-lg bg-[#1e1e20]">
          <div className="flex items-center gap-2 mb-2">
            <TrendIcon
              className={`w-4 h-4 ${
                consistency.trend === "up"
                  ? "text-[#22c55e]"
                  : consistency.trend === "down"
                  ? "text-[#ef4444]"
                  : "text-[#6b6b72]"
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#6b6b72]">
              Consistência
            </span>
          </div>
          <p className="text-5xl font-bold text-white mb-1">{consistency.score}</p>
          <p className="text-sm" style={{ color: consistencyLevel.color }}>
            /100
          </p>
          {/* Progress bar */}
          <div className="w-full mt-3">
            <div className="h-2 bg-[#2a2a2c] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${consistency.score}%`,
                  backgroundColor: consistencyLevel.color,
                }}
              />
            </div>
            <p
              className="text-xs mt-1.5 font-medium"
              style={{ color: consistencyLevel.color }}
            >
              {consistencyLevel.label}
            </p>
          </div>
        </div>

        {/* Weekly Digest Block */}
        <div className="flex flex-col items-center justify-center text-center p-4 rounded-lg bg-[#1e1e20]">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#6b6b72] mb-3">
            Esta Semana
          </span>
          <div className="space-y-1.5">
            <p className="text-2xl font-bold text-white">
              {weeklyDigest.laps.toLocaleString()}{" "}
              <span className="text-sm font-normal text-[#6b6b72]">voltas</span>
            </p>
            <p className="text-lg text-[#6b6b72]">
              {weeklyDigest.sessions}{" "}
              <span className="text-sm">
                {weeklyDigest.sessions === 1 ? "sessão" : "sessões"}
              </span>
            </p>
            {weeklyDigest.pbsBeaten > 0 && (
              <p className="text-sm text-[#fbbf24] font-medium">
                🏆 {weeklyDigest.pbsBeaten} PB{weeklyDigest.pbsBeaten !== 1 ? "s" : ""} batido
                {weeklyDigest.pbsBeaten !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          {weeklyDigest.deltaVsLastWeek !== 0 && (
            <p
              className={`text-xs mt-3 ${
                weeklyDigest.deltaVsLastWeek > 0 ? "text-[#22c55e]" : "text-[#ef4444]"
              }`}
            >
              {weeklyDigest.deltaVsLastWeek > 0 ? "+" : ""}
              {weeklyDigest.deltaVsLastWeek.toFixed(0)}% vs semana anterior
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

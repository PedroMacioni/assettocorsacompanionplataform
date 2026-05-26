"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface ActivityCalendarProps {
  sessions: Array<{ date: string; count: number }>;
  daysToShow?: number;
  weekdayDist?: number[];
  disableLinks?: boolean;
}

function getColor(count: number): string {
  if (count === 0) return "var(--color-muted)";
  if (count <= 2) return "#e8612a40";
  if (count <= 4) return "#e8612a80";
  return "#e8612a";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

export function ActivityCalendar({ sessions, daysToShow = 90, weekdayDist, disableLinks = false }: ActivityCalendarProps) {
  const t = useTranslations("ActivityCalendar");
  const [tooltip, setTooltip] = useState<{ x: number; y: number; below: boolean; text: string } | null>(null);

  const { totalActiveDays, weeks, monthLabels } = useMemo(() => {
    const countMap = new Map<string, number>();
    sessions.forEach((s) => countMap.set(s.date, s.count));

    const dates: Array<{ date: string; count: number; dayOfWeek: number }> = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      dates.push({ date: dateStr, count: countMap.get(dateStr) ?? 0, dayOfWeek: d.getDay() });
    }

    const weeksData: Array<Array<{ date: string; count: number } | null>> = [];
    let currentWeek: Array<{ date: string; count: number } | null> = Array(7).fill(null);

    const firstDayOfWeek = dates[0]?.dayOfWeek ?? 0;
    for (let i = 0; i < firstDayOfWeek; i++) currentWeek[i] = null;

    dates.forEach((d) => {
      if (d.dayOfWeek === 0 && currentWeek.some((c) => c !== null)) {
        weeksData.push(currentWeek);
        currentWeek = Array(7).fill(null);
      }
      currentWeek[d.dayOfWeek] = { date: d.date, count: d.count };
    });

    if (currentWeek.some((c) => c !== null)) weeksData.push(currentWeek);

    const labels: Record<number, string> = {};
    weeksData.forEach((week, weekIdx) => {
      week.forEach((day) => {
        if (day) {
          const d = new Date(day.date + "T12:00:00");
          if (d.getDate() <= 7) {
            labels[weekIdx] = d.toLocaleDateString("pt-BR", { month: "short" });
          }
        }
      });
    });

    return { totalActiveDays: dates.filter((d) => d.count > 0).length, weeks: weeksData, monthLabels: labels };
  }, [sessions, daysToShow]);

  const maxWeekday = weekdayDist ? Math.max(...weekdayDist, 1) : 1;

  return (
    <div className="bg-card border border-border rounded-md p-5 relative transition-all duration-150 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
        {t("title")}
      </p>

      <div className="flex gap-5">
        {/* Calendário — células escalam para preencher o espaço disponível */}
        <div className="flex-1 min-w-0">
          {/* Month labels */}
          <div
            className="mb-1"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${weeks.length}, 1fr)`,
              gap: 3,
            }}
          >
            {weeks.map((_, weekIdx) => (
              <div
                key={weekIdx}
                className="text-[8px] text-muted-foreground uppercase tracking-wider leading-none overflow-hidden"
              >
                {monthLabels[weekIdx] ?? ""}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${weeks.length}, 1fr)`,
              gap: 3,
            }}
          >
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-[3px]">
                {week.map((day, dayIdx) =>
                  day && day.count > 0 ? (
                    disableLinks ? (
                      <div
                        key={dayIdx}
                        className="w-full aspect-square rounded-sm transition-all duration-150 hover:scale-110 cursor-default"
                        style={{ backgroundColor: getColor(day.count) }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const below = rect.top < 120;
                          setTooltip({
                            x: rect.left + rect.width / 2,
                            y: below ? rect.bottom + 6 : rect.top - 8,
                            below,
                            text: t("tooltip", { count: day.count, date: formatDate(day.date) }),
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    ) : (
                    <Link
                      key={dayIdx}
                      href={`/sessions?date=${day.date}`}
                      className="w-full aspect-square rounded-sm transition-all duration-150 hover:scale-110 hover:ring-1 hover:ring-primary block"
                      style={{ backgroundColor: getColor(day.count) }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const below = rect.top < 120;
                        setTooltip({
                          x: rect.left + rect.width / 2,
                          y: below ? rect.bottom + 6 : rect.top - 8,
                          below,
                          text: t("tooltip", { count: day.count, date: formatDate(day.date) }),
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    )
                  ) : (
                    <div
                      key={dayIdx}
                      className="w-full aspect-square rounded-sm"
                      style={{ backgroundColor: day ? getColor(0) : "transparent" }}
                    />
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Coluna direita — métricas */}
        <div className="w-24 shrink-0 flex flex-col justify-between">
          {/* Dias ativos */}
          <div>
            <p className="text-3xl font-bold text-foreground leading-none">{totalActiveDays}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1.5">
              {t("statDays")}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 opacity-60">
              {daysToShow} {t("daysLabel")}
            </p>
          </div>

          {/* Distribuição por dia da semana */}
          {weekdayDist && weekdayDist.some((n) => n > 0) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                {t("weekdayTitle")}
              </p>
              <div className="flex items-end gap-[3px]" style={{ height: 36 }}>
                {weekdayDist.map((count, i) => {
                  const pct = (count / maxWeekday) * 100;
                  const isTop = count === maxWeekday && count > 0;
                  const isWeekend = i === 0 || i === 6;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end" style={{ height: 28 }}>
                        <div
                          className={`w-full rounded-sm ${
                            isTop ? "bg-primary" : isWeekend ? "bg-primary/30" : "bg-primary/55"
                          }`}
                          style={{ height: count > 0 ? `${Math.max(pct, 10)}%` : 0 }}
                        />
                      </div>
                      <span className="text-[7px] text-muted-foreground leading-none">
                        {["D", "S", "T", "Q", "Q", "S", "S"][i]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Legenda */}
          <div className="flex flex-col gap-1">
            <p className="text-[9px] text-muted-foreground">{t("less")}</p>
            <div className="flex items-center gap-0.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-muted" />
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#e8612a40" }} />
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#e8612a80" }} />
              <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
            </div>
            <p className="text-[9px] text-muted-foreground">{t("more")}</p>
          </div>
        </div>
      </div>

      {tooltip && (
        <div
          className={`fixed z-50 px-2.5 py-1.5 bg-popover border border-border text-popover-foreground text-xs rounded-md shadow-lg pointer-events-none transform -translate-x-1/2 whitespace-nowrap ${
            tooltip.below ? "" : "-translate-y-full"
          }`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

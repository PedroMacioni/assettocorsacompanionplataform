"use client";

import { useMemo, useState } from "react";

interface ActivityCalendarProps {
  sessions: Array<{
    date: string; // YYYY-MM-DD
    count: number;
  }>;
  daysToShow?: number;
}

function getColor(count: number): string {
  if (count === 0) return "#1e1e20";
  if (count <= 2) return "#e8612a40";
  if (count <= 4) return "#e8612a80";
  return "#e8612a";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });
}

export function ActivityCalendar({ sessions, daysToShow = 90 }: ActivityCalendarProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const { grid, totalActiveDays, weeks } = useMemo(() => {
    // Build a map of date -> count
    const countMap = new Map<string, number>();
    sessions.forEach((s) => {
      countMap.set(s.date, s.count);
    });

    // Generate array of dates for the last N days
    const dates: Array<{ date: string; count: number; dayOfWeek: number }> = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      dates.push({
        date: dateStr,
        count: countMap.get(dateStr) ?? 0,
        dayOfWeek: d.getDay(),
      });
    }

    // Organize into weeks (columns) for the grid
    // Each column is a week, each row is a day of week (0-6)
    const weeksData: Array<Array<{ date: string; count: number } | null>> = [];
    let currentWeek: Array<{ date: string; count: number } | null> = Array(7).fill(null);

    // Fill in empty cells at the start of first week
    const firstDayOfWeek = dates[0]?.dayOfWeek ?? 0;
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek[i] = null;
    }

    dates.forEach((d) => {
      if (d.dayOfWeek === 0 && currentWeek.some((c) => c !== null)) {
        weeksData.push(currentWeek);
        currentWeek = Array(7).fill(null);
      }
      currentWeek[d.dayOfWeek] = { date: d.date, count: d.count };
    });

    if (currentWeek.some((c) => c !== null)) {
      weeksData.push(currentWeek);
    }

    const activeDays = dates.filter((d) => d.count > 0).length;

    return { grid: dates, totalActiveDays: activeDays, weeks: weeksData };
  }, [sessions, daysToShow]);

  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5 relative">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#6b6b72] mb-4">
        Atividade (últimos {daysToShow} dias)
      </p>

      {/* Calendar grid */}
      <div className="flex gap-[3px] overflow-x-auto pb-2">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-[3px]">
            {week.map((day, dayIdx) => (
              <div
                key={dayIdx}
                className="w-3 h-3 rounded-sm transition-all duration-150 hover:scale-125 cursor-default"
                style={{ backgroundColor: day ? getColor(day.count) : "transparent" }}
                onMouseEnter={(e) => {
                  if (day) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                      text: `${day.count} ${day.count === 1 ? "sessão" : "sessões"} em ${formatDate(day.date)}`,
                    });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-[#6b6b72]">
          Total: <span className="text-white font-medium">{totalActiveDays}</span> dias ativos
        </p>
        <div className="flex items-center gap-1 text-[10px] text-[#6b6b72]">
          <span>Menos</span>
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#1e1e20" }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#e8612a40" }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#e8612a80" }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#e8612a" }} />
          <span>Mais</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 bg-[#2a2a2c] text-white text-xs rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

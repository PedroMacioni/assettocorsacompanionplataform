"use client";

import { useRef, useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = ["#e8612a", "#22c55e", "#3b82f6"];

function fmtMs(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

type DataPoint = Record<string, string | number | null>;

type Props = {
  data: DataPoint[];
  tracks: string[];
  trackLabels?: Record<string, string>;
};

export default function PaceLineChart({ data, tracks, trackLabels = {} }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isMobile = containerWidth < 480;

  const yAxisWidth = isMobile ? 50 : 68;
  const chartHeight = isMobile ? 200 : 280;
  const xAxisFontSize = isMobile ? 9 : 11;
  const yAxisFontSize = isMobile ? 9 : 10;
  const xAxisInterval = isMobile ? "preserveStartEnd" : 0;
  const margin = isMobile
    ? { top: 4, right: 4, bottom: 4, left: 0 }
    : { top: 4, right: 8, bottom: 4, left: 8 };

  return (
    <div ref={containerRef}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <LineChart data={data} margin={margin}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: xAxisFontSize, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            interval={xAxisInterval}
          />
          <YAxis
            tickFormatter={fmtMs}
            tick={{ fontSize: yAxisFontSize, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={yAxisWidth}
            reversed
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--color-muted-foreground)", marginBottom: 4 }}
            formatter={(val) => [typeof val === "number" ? fmtMs(val) : String(val ?? "")]}
          />
          {tracks.map((t, i) => (
            <Line
              key={t}
              type="monotone"
              dataKey={t}
              name={trackLabels[t] ?? t}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              connectNulls
            />
          ))}
          {tracks.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(v) => (
                <span style={{ color: "var(--color-muted-foreground)" }}>
                  {trackLabels[String(v)] ?? String(v).replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </span>
              )}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

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
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#6b6b72" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmtMs}
          tick={{ fontSize: 10, fill: "#6b6b72" }}
          axisLine={false}
          tickLine={false}
          width={68}
          reversed
        />
        <Tooltip
          contentStyle={{
            background: "#161618",
            border: "1px solid #2a2a2c",
            borderRadius: 6,
            fontSize: 12,
          }}
          labelStyle={{ color: "#6b6b72", marginBottom: 4 }}
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
              <span style={{ color: "#6b6b72" }}>
                {trackLabels[String(v)] ?? String(v).replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </span>
            )}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

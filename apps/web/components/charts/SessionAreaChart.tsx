"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Props = { data: { week: string; sessions: number }[] };

export default function SessionAreaChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
        <defs>
          <linearGradient id="sgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#e8612a" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#e8612a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="week"
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--muted-foreground)" }}
        />
        <Area
          type="monotone"
          dataKey="sessions"
          stroke="#e8612a"
          strokeWidth={2}
          fill="url(#sgGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

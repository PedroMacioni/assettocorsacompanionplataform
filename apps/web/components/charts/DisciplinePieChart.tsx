"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const PALETTE: Record<string, string> = {
  Race: "#22c55e",
  Hotlap: "#e8612a",
  Practice: "#6b6b72",
  "Time Attack": "#3b82f6",
  Unknown: "#374151",
};

type Props = { data: { name: string; value: number }[] };

export default function DisciplinePieChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={52}
          outerRadius={78}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={PALETTE[entry.name] ?? `hsl(${i * 60}, 60%, 55%)`}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--muted-foreground)" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          formatter={(v) => <span style={{ color: "var(--muted-foreground)" }}>{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

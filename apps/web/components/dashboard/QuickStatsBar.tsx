import { Map, Car, Ruler, Flag } from "lucide-react";
import { formatDistance } from "@/lib/format";

interface QuickStatsBarProps {
  tracks: number;
  cars: number;
  distanceKm: number;
  laps: number;
}

export function QuickStatsBar({ tracks, cars, distanceKm, laps }: QuickStatsBarProps) {
  const stats = [
    {
      icon: Map,
      value: tracks,
      label: "pistas visitadas",
      format: (v: number) => v.toString(),
    },
    {
      icon: Car,
      value: cars,
      label: "carros utilizados",
      format: (v: number) => v.toString(),
    },
    {
      icon: Ruler,
      value: distanceKm,
      label: "percorridos",
      format: (v: number) => formatDistance(v),
    },
    {
      icon: Flag,
      value: laps,
      label: "voltas completadas",
      format: (v: number) => v.toLocaleString(),
    },
  ];

  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-4">
      <div className="flex items-center justify-between divide-x divide-[#2a2a2c]">
        {stats.map(({ icon: Icon, value, label, format }, i) => (
          <div
            key={label}
            className={`flex-1 flex flex-col items-center text-center ${
              i === 0 ? "" : "pl-4"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4 text-[#6b6b72]" />
              <span className="text-xl font-semibold text-white">
                {format(value)}
              </span>
            </div>
            <span className="text-xs text-[#6b6b72]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

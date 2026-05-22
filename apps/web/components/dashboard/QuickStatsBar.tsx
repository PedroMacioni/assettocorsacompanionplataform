import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Map, Car, Ruler, Flag } from "lucide-react";
import { formatDistance } from "@/lib/format";

interface QuickStatsBarProps {
  tracks: number;
  cars: number;
  distanceKm: number;
  laps: number;
}

export async function QuickStatsBar({ tracks, cars, distanceKm, laps }: QuickStatsBarProps) {
  const t = await getTranslations("QuickStats");

  const stats = [
    {
      icon: Map,
      value: tracks.toString(),
      label: t("tracks"),
      href: "/tracks",
    },
    {
      icon: Car,
      value: cars.toString(),
      label: t("cars"),
      href: "/garage",
    },
    {
      icon: Ruler,
      value: formatDistance(distanceKm),
      label: t("distance"),
      href: null,
    },
    {
      icon: Flag,
      value: laps.toLocaleString("pt-BR"),
      label: t("totalLaps"),
      href: null,
    },
  ];

  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#2a2a2c]">
        {stats.map(({ icon: Icon, value, label, href }, i) => {
          const content = (
            <div
              className={`flex flex-col items-center text-center py-3 md:py-0 ${
                i % 2 === 1 ? "pl-4" : ""
              } md:pl-4 first:pl-0`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-[#6b6b72]" />
                <span className="text-xl font-semibold text-white">{value}</span>
              </div>
              <span className="text-xs text-[#6b6b72]">{label}</span>
            </div>
          );

          if (href) {
            return (
              <Link
                key={label}
                href={href}
                className="hover:text-[#e8612a] transition-colors group"
              >
                <div
                  className={`flex flex-col items-center text-center py-3 md:py-0 ${
                    i === 0 ? "" : "pl-4"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-[#6b6b72] group-hover:text-[#e8612a] transition-colors" />
                    <span className="text-xl font-semibold text-white group-hover:text-[#e8612a] transition-colors">
                      {value}
                    </span>
                  </div>
                  <span className="text-xs text-[#6b6b72] group-hover:text-[#e8612a] transition-colors">
                    {label}
                  </span>
                </div>
              </Link>
            );
          }

          return (
            <div key={label} className={`flex flex-col items-center text-center py-3 md:py-0 ${i === 0 ? "" : "md:pl-4"}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-[#6b6b72]" />
                <span className="text-xl font-semibold text-white">{value}</span>
              </div>
              <span className="text-xs text-[#6b6b72]">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

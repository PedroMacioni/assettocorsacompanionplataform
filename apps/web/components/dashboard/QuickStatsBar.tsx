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
    { icon: Map,   value: tracks.toString(),            label: t("tracks"),    href: "/tracks"  },
    { icon: Car,   value: cars.toString(),              label: t("cars"),      href: "/garage"  },
    { icon: Ruler, value: formatDistance(distanceKm),   label: t("distance"),  href: null       },
    { icon: Flag,  value: laps.toLocaleString("pt-BR"), label: t("totalLaps"), href: null       },
  ];

  return (
    <div className="bg-card border border-border rounded-md p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
        {stats.map(({ icon: Icon, value, label, href }, i) => {
          const inner = (isLink: boolean) => (
            <div className={`flex flex-col items-center text-center py-3 md:py-0 ${i === 0 ? "" : "md:pl-4"}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${isLink ? "text-muted-foreground group-hover:text-primary transition-colors" : "text-muted-foreground"}`} />
                <span className={`text-xl font-semibold ${isLink ? "text-foreground group-hover:text-primary transition-colors" : "text-foreground"}`}>
                  {value}
                </span>
              </div>
              <span className={`text-xs ${isLink ? "text-muted-foreground group-hover:text-primary transition-colors" : "text-muted-foreground"}`}>
                {label}
              </span>
            </div>
          );

          return href ? (
            <Link key={label} href={href} className="group">
              {inner(true)}
            </Link>
          ) : (
            <div key={label}>{inner(false)}</div>
          );
        })}
      </div>
    </div>
  );
}

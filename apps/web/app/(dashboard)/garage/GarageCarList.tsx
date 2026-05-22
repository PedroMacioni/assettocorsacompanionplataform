"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Search, X, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { slugToName } from "@/lib/format";
import type { TopCar } from "@/lib/types";

function CarBadge({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <Car className="w-4 h-4 text-muted-foreground/50" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="w-full h-full object-contain"
    />
  );
}

interface Props {
  cars: TopCar[];
  preferences: Record<string, string | null>;
  selectedCarId: string;
  carImageBase: string;
}

export function GarageCarList({ cars, preferences, selectedCarId, carImageBase }: Props) {
  const t = useTranslations("Garage");
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? cars.filter((c) => {
        const name = (preferences[c.car_id] ?? slugToName(c.car_id)).toLowerCase();
        return name.includes(search.toLowerCase()) || c.car_id.includes(search.toLowerCase());
      })
    : cars;

  return (
    <div className="w-56 shrink-0 flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full bg-muted/60 border border-border rounded-md pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-0.5">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground px-3 py-4 text-center">{t("noResults")}</p>
        ) : (
          filtered.map((c) => {
            const active = c.car_id === selectedCarId;
            const displayName = preferences[c.car_id] ?? slugToName(c.car_id);
            return (
              <Link
                key={c.car_id}
                href={`/garage?car=${c.car_id}`}
                className={cn(
                  "relative flex items-center gap-2.5 px-3 py-2.5 rounded-md transition-colors group",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full" />
                )}
                <div className="w-8 h-8 rounded shrink-0 overflow-hidden bg-muted flex items-center justify-center border border-border/50">
                  <CarBadge src={`${carImageBase}/${c.car_id}.png`} alt={displayName} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate leading-tight">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{c.sessions} {t("summary.sessionsOther")}</p>
                </div>
                {active && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

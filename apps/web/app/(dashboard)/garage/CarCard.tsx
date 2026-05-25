"use client";

import { cn } from "@/lib/utils";
import { slugToName, formatDistance } from "@/lib/format";
import { Star } from "lucide-react";
import type { TopCar, CarSpecs, UserCarPreference } from "@/lib/types";

interface Props {
  car: TopCar;
  specs: CarSpecs | null;
  pref: UserCarPreference | null;
  onSelect: (carId: string) => void;
}

export function CarCard({ car, specs, pref, onSelect }: Props) {
  const displayName = pref?.display_name ?? specs?.name ?? slugToName(car.car_id);
  const classLabel = specs?.class;

  return (
    <button
      type="button"
      onClick={() => onSelect(car.car_id)}
      className={cn(
        "w-full text-left bg-card border border-border rounded-xl p-4",
        "hover:bg-accent/40 hover:border-border/80 transition-colors cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-foreground leading-tight truncate">{displayName}</p>
        {pref?.is_favorite && (
          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 shrink-0 mt-0.5" />
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        {classLabel && (
          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            {classLabel}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {car.sessions} {car.sessions === 1 ? "sessão" : "sessões"}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">{formatDistance(car.total_distance_km)}</p>
    </button>
  );
}

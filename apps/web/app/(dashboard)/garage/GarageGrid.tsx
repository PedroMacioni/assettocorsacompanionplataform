"use client";

import { CarCard } from "./CarCard";
import type { TopCar, CarSpecs, UserCarPreference } from "@/lib/types";

interface Props {
  cars: TopCar[];
  specsMap: Record<string, CarSpecs>;
  prefMap: Record<string, UserCarPreference>;
  onSelect: (carId: string) => void;
}

export function GarageGrid({ cars, specsMap, prefMap, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {cars.map((car) => (
        <CarCard
          key={car.car_id}
          car={car}
          specs={specsMap[car.car_id] ?? null}
          pref={prefMap[car.car_id] ?? null}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

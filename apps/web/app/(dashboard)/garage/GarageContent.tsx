"use client";

import { useState, useCallback } from "react";
import { GarageFilters } from "./GarageFilters";
import { GarageGrid } from "./GarageGrid";
import { CarDetail } from "./CarDetailModal";
import { EmptyState } from "@/components/EmptyState";
import type { TopCar, CarSpecs, UserCarPreference } from "@/lib/types";

interface Props {
  cars: TopCar[];
  specsMap: Record<string, CarSpecs>;
  prefMap: Record<string, UserCarPreference>;
  availableClasses: string[];
  availableBrands: string[];
  totalCars: number;
  carImageBase: string;
}

export function GarageContent({
  cars,
  specsMap,
  prefMap,
  availableClasses,
  availableBrands,
  totalCars,
  carImageBase,
}: Props) {
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [localPrefMap, setLocalPrefMap] = useState(prefMap);

  const selectedCar = selectedCarId
    ? (cars.find((c) => c.car_id === selectedCarId) ?? null)
    : null;

  const handleFavoriteChange = useCallback((carId: string, isFavorite: boolean) => {
    setLocalPrefMap((prev) => ({
      ...prev,
      [carId]: {
        ...(prev[carId] ?? { user_id: "", car_id: carId, display_name: null, updated_at: "" }),
        is_favorite: isFavorite,
      },
    }));
  }, []);

  if (selectedCar) {
    return (
      <CarDetail
        car={selectedCar}
        specs={specsMap[selectedCar.car_id] ?? null}
        pref={localPrefMap[selectedCar.car_id] ?? null}
        carImageSrc={`${carImageBase}/${selectedCar.car_id}.png`}
        onClose={() => setSelectedCarId(null)}
        onFavoriteChange={handleFavoriteChange}
      />
    );
  }

  return (
    <>
      <GarageFilters
        availableClasses={availableClasses}
        availableBrands={availableBrands}
        totalCars={totalCars}
        filteredCount={cars.length}
      />

      {cars.length === 0 ? (
        <EmptyState
          title="Nenhum carro encontrado"
          description="Tente ajustar ou limpar os filtros."
        />
      ) : (
        <GarageGrid
          cars={cars}
          specsMap={specsMap}
          prefMap={localPrefMap}
          onSelect={setSelectedCarId}
        />
      )}
    </>
  );
}

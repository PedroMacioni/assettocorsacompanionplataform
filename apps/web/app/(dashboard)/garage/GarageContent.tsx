"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { GarageFilters } from "./GarageFilters";
import { GarageGrid } from "./GarageGrid";
import { CarDetail } from "./CarDetailModal";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/PageLoader";
import { PaginationClient } from "@/components/ui/pagination-client";
import { formatDistance } from "@/lib/format";
import type { TopCar, CarSpecs, UserCarPreference } from "@/lib/types";

interface Props {
  cars: TopCar[];
  specsMap: Record<string, CarSpecs>;
  prefMap: Record<string, UserCarPreference>;
  availableClasses: string[];
  availableBrands: string[];
  totalCars: number;
  totalSessions: number;
  totalDistance: number;
  currentPage: number;
  totalPages: number;
  queryParams: Record<string, string | undefined>;
}

export function GarageContent({
  cars,
  specsMap,
  prefMap,
  availableClasses,
  availableBrands,
  totalCars,
  totalSessions,
  totalDistance,
  currentPage,
  totalPages,
  queryParams,
}: Props) {
  const t = useTranslations("Garage");
  const router = useRouter();
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [localPrefMap, setLocalPrefMap] = useState(prefMap);
  const [isPending, startTransition] = useTransition();

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

  function handlePageChange(page: number) {
    if (page === currentPage || isPending) return;

    const next = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) next.set(key, value);
    });
    next.set("page", String(page));

    startTransition(() => {
      router.push(`/garage?${next.toString()}`);
    });
  }

  if (selectedCar) {
    return (
      <CarDetail
        car={selectedCar}
        specs={specsMap[selectedCar.car_id] ?? null}
        pref={localPrefMap[selectedCar.car_id] ?? null}
        onClose={() => setSelectedCarId(null)}
        onFavoriteChange={handleFavoriteChange}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("yourCars")}
        </p>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{totalCars}</span>
          <span>{totalCars === 1 ? t("summary.carsOne") : t("summary.carsOther")}</span>
          <span className="opacity-30">·</span>
          <span className="font-semibold text-foreground">{totalSessions.toLocaleString()}</span>
          <span>{totalSessions === 1 ? t("summary.sessionsOne") : t("summary.sessionsOther")}</span>
          <span className="opacity-30">·</span>
          <span className="font-semibold text-foreground">{formatDistance(totalDistance)}</span>
          <span>{t("summary.driven")}</span>
        </div>
      </div>

      <GarageFilters
        availableClasses={availableClasses}
        availableBrands={availableBrands}
      />

      {isPending ? (
        <div className="rounded-lg border border-border bg-card">
          <PageLoader size="md" className="min-h-[320px]" />
        </div>
      ) : cars.length === 0 ? (
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

      <PaginationClient
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}

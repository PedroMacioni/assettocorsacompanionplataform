"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CalendarDays,
  CalendarRange,
  Car,
  Flag,
  Trophy,
} from "lucide-react";
import { FilterBar, FilterControl } from "@/components/FilterBar";

export type SessionFilterOption = {
  value: string;
  label: string;
};

type SelectedFilters = {
  car?: string;
  track?: string;
  type?: string;
  period?: string;
  date?: string;
};

type Props = {
  cars: SessionFilterOption[];
  tracks: SessionFilterOption[];
  types: SessionFilterOption[];
  selected: SelectedFilters;
  activeCount: number;
};

const inputClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30";

export function SessionsFilters({
  cars,
  tracks,
  types,
  selected,
  activeCount,
}: Props) {
  const t = useTranslations("Sessions");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(nextParams: URLSearchParams) {
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function updateFilter(key: keyof SelectedFilters, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    const paramKey = key === "period" ? "filter" : key;

    if (value) {
      next.set(paramKey, value);
    } else {
      next.delete(paramKey);
    }

    if (key === "period" && value) next.delete("date");
    if (key === "date" && value) next.delete("filter");
    next.delete("page");

    navigate(next);
  }

  function clearFilters() {
    navigate(new URLSearchParams());
  }

  return (
    <FilterBar
      title={t("filters.title")}
      activeLabel={activeCount > 0 ? t("filters.active", { count: activeCount }) : undefined}
      clearLabel={t("filters.clear")}
      canClear={activeCount > 0}
      onClear={clearFilters}
    >
      <FilterControl
        label={t("filters.period")}
        icon={<CalendarRange className="size-3" aria-hidden="true" />}
      >
        <select
          value={selected.period ?? ""}
          onChange={(event) => updateFilter("period", event.target.value)}
          className={inputClassName}
        >
          <option value="">{t("filters.allPeriods")}</option>
          <option value="this_week">{t("filters.thisWeek")}</option>
          <option value="last_30_days">{t("filters.last30Days")}</option>
        </select>
      </FilterControl>

      <FilterControl
        label={t("filters.car")}
        icon={<Car className="size-3" aria-hidden="true" />}
      >
        <select
          value={selected.car ?? ""}
          onChange={(event) => updateFilter("car", event.target.value)}
          className={inputClassName}
        >
          <option value="">{t("filters.allCars")}</option>
          {cars.map((car) => (
            <option key={car.value} value={car.value}>
              {car.label}
            </option>
          ))}
        </select>
      </FilterControl>

      <FilterControl
        label={t("filters.track")}
        icon={<Flag className="size-3" aria-hidden="true" />}
      >
        <select
          value={selected.track ?? ""}
          onChange={(event) => updateFilter("track", event.target.value)}
          className={inputClassName}
        >
          <option value="">{t("filters.allTracks")}</option>
          {tracks.map((track) => (
            <option key={track.value} value={track.value}>
              {track.label}
            </option>
          ))}
        </select>
      </FilterControl>

      <FilterControl
        label={t("filters.type")}
        icon={<Trophy className="size-3" aria-hidden="true" />}
      >
        <select
          value={selected.type ?? ""}
          onChange={(event) => updateFilter("type", event.target.value)}
          className={inputClassName}
        >
          <option value="">{t("filters.allTypes")}</option>
          {types.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </FilterControl>

      <FilterControl
        label={t("filters.date")}
        icon={<CalendarDays className="size-3" aria-hidden="true" />}
      >
        <input
          type="date"
          value={selected.date ?? ""}
          onChange={(event) => updateFilter("date", event.target.value)}
          className={inputClassName}
        />
      </FilterControl>
    </FilterBar>
  );
}

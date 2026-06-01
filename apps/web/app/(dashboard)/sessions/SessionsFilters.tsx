"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarRange, Car, Flag, Trophy } from "lucide-react";
import {
  CollapsibleFilterBar,
  FilterControl,
} from "@/components/ui/collapsible-filter-bar";

export type SessionFilterOption = {
  value: string;
  label: string;
};

type Props = {
  cars: SessionFilterOption[];
  tracks: SessionFilterOption[];
  selected: {
    car?: string;
    track?: string;
    period?: string;
    onlyPb?: boolean;
  };
  activeCount: number;
};

const inputClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30";

const checkboxClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30 flex items-center gap-2 cursor-pointer";

export function SessionsFilters({ cars, tracks, selected, activeCount }: Props) {
  const t = useTranslations("Sessions");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(nextParams: URLSearchParams) {
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete("page");
    navigate(next);
  }

  function toggleOnlyPb() {
    const next = new URLSearchParams(searchParams.toString());
    if (selected.onlyPb) {
      next.delete("onlyPb");
    } else {
      next.set("onlyPb", "1");
    }
    next.delete("page");
    navigate(next);
  }

  function clearFilters() {
    navigate(new URLSearchParams());
  }

  return (
    <CollapsibleFilterBar
      title={t("filters.title")}
      activeCount={activeCount}
      activeLabel={t("filters.activeCount")}
      clearLabel={t("filters.clear")}
      expandLabel={t("filters.expand")}
      collapseLabel={t("filters.collapse")}
      storageKey="sessions-filters-collapsed"
      defaultCollapsed={true}
      canClear={activeCount > 0}
      onClear={clearFilters}
    >
      <FilterControl
        label={t("filters.period")}
        icon={<CalendarRange className="size-3" aria-hidden="true" />}
      >
        <select
          value={selected.period ?? ""}
          onChange={(e) => updateFilter("filter", e.target.value)}
          className={inputClassName}
        >
          <option value="">{t("filters.allPeriods")}</option>
          <option value="this_week">{t("filters.thisWeek")}</option>
          <option value="last_30_days">{t("filters.last30Days")}</option>
          <option value="last_90_days">{t("filters.last90Days")}</option>
          <option value="this_year">{t("filters.thisYear")}</option>
        </select>
      </FilterControl>

      <FilterControl
        label={t("filters.car")}
        icon={<Car className="size-3" aria-hidden="true" />}
      >
        <select
          value={selected.car ?? ""}
          onChange={(e) => updateFilter("car", e.target.value)}
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
          onChange={(e) => updateFilter("track", e.target.value)}
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
        label={t("filters.onlyPb")}
        icon={<Trophy className="size-3" aria-hidden="true" />}
      >
        <button
          type="button"
          onClick={toggleOnlyPb}
          className={checkboxClassName}
        >
          <input
            type="checkbox"
            checked={selected.onlyPb ?? false}
            readOnly
            className="size-4 rounded border-input accent-primary"
          />
          <span>{t("filters.onlyPb")}</span>
        </button>
      </FilterControl>
    </CollapsibleFilterBar>
  );
}

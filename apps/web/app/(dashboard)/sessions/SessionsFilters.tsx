"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarRange, Car, Flag, Trophy } from "lucide-react";
import {
  CollapsibleFilterBar,
  FilterControl,
} from "@/components/ui/collapsible-filter-bar";
import { SelectNative } from "@/components/ui/select-native";

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

const toggleClass =
  "flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-input bg-background/80 px-2.5 text-sm text-foreground transition-colors hover:bg-muted/60 dark:bg-input/30";

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
      activeLabel={activeCount > 0 ? t("filters.activeCount", { count: activeCount }) : undefined}
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
        <SelectNative
          value={selected.period ?? ""}
          onChange={(e) => updateFilter("filter", e.target.value)}
        >
          <option value="">{t("filters.allPeriods")}</option>
          <option value="this_week">{t("filters.thisWeek")}</option>
          <option value="last_30_days">{t("filters.last30Days")}</option>
          <option value="last_90_days">{t("filters.last90Days")}</option>
          <option value="this_year">{t("filters.thisYear")}</option>
        </SelectNative>
      </FilterControl>

      <FilterControl
        label={t("filters.car")}
        icon={<Car className="size-3" aria-hidden="true" />}
      >
        <SelectNative
          value={selected.car ?? ""}
          onChange={(e) => updateFilter("car", e.target.value)}
        >
          <option value="">{t("filters.allCars")}</option>
          {cars.map((car) => (
            <option key={car.value} value={car.value}>
              {car.label}
            </option>
          ))}
        </SelectNative>
      </FilterControl>

      <FilterControl
        label={t("filters.track")}
        icon={<Flag className="size-3" aria-hidden="true" />}
      >
        <SelectNative
          value={selected.track ?? ""}
          onChange={(e) => updateFilter("track", e.target.value)}
        >
          <option value="">{t("filters.allTracks")}</option>
          {tracks.map((track) => (
            <option key={track.value} value={track.value}>
              {track.label}
            </option>
          ))}
        </SelectNative>
      </FilterControl>

      <FilterControl
        label={t("filters.onlyPb")}
        icon={<Trophy className="size-3" aria-hidden="true" />}
      >
        <button
          type="button"
          onClick={toggleOnlyPb}
          className={toggleClass}
        >
          <div
            className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
              selected.onlyPb
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background"
            }`}
          >
            {selected.onlyPb && (
              <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="2,6 5,9 10,3" />
              </svg>
            )}
          </div>
          <span>{t("filters.onlyPb")}</span>
        </button>
      </FilterControl>
    </CollapsibleFilterBar>
  );
}

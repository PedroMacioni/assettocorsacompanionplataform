"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Car, Tag, Star, Clock, Search } from "lucide-react";
import { FilterBar, FilterControl } from "@/components/FilterBar";

interface Props {
  availableClasses: string[];
  availableBrands: string[];
}

const inputClassName =
  "h-9 w-full rounded-lg border border-input bg-control px-2.5 text-sm text-foreground outline-none transition-colors hover:bg-control-hover focus:border-ring focus:bg-surface-raised focus:ring-3 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60";

export function GarageFilters({ availableClasses, availableBrands }: Props) {
  const t = useTranslations("Garage");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const classFilter = searchParams.get("class") ?? "";
  const brandFilter = searchParams.get("brand") ?? "";
  const favoritesOnly = searchParams.get("favorites") === "1";
  const recentOnly = searchParams.get("recent") === "1";

  const activeCount = [search, classFilter, brandFilter, favoritesOnly, recentOnly].filter(Boolean).length;

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
        label={t("filters.search")}
        icon={<Search className="size-3" aria-hidden="true" />}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => updateFilter("search", e.target.value)}
          placeholder={t("searchPlaceholder")}
          className={inputClassName}
        />
      </FilterControl>

      <FilterControl
        label={t("filters.class")}
        icon={<Tag className="size-3" aria-hidden="true" />}
      >
        <select
          value={classFilter}
          onChange={(e) => updateFilter("class", e.target.value)}
          className={inputClassName}
        >
          <option value="">{t("filters.allClasses")}</option>
          {availableClasses.map((cls) => (
            <option key={cls} value={cls}>{cls}</option>
          ))}
        </select>
      </FilterControl>

      <FilterControl
        label={t("filters.brand")}
        icon={<Car className="size-3" aria-hidden="true" />}
      >
        <select
          value={brandFilter}
          onChange={(e) => updateFilter("brand", e.target.value)}
          className={inputClassName}
        >
          <option value="">{t("filters.allBrands")}</option>
          {availableBrands.map((brand) => (
            <option key={brand} value={brand}>{brand}</option>
          ))}
        </select>
      </FilterControl>

      <FilterControl
        label={t("filters.favorites")}
        icon={<Star className="size-3" aria-hidden="true" />}
      >
        <select
          value={favoritesOnly ? "1" : ""}
          onChange={(e) => updateFilter("favorites", e.target.value)}
          className={inputClassName}
        >
          <option value="">{t("filters.allCars")}</option>
          <option value="1">{t("filters.onlyFavorites")}</option>
        </select>
      </FilterControl>

      <FilterControl
        label={t("filters.recent")}
        icon={<Clock className="size-3" aria-hidden="true" />}
      >
        <select
          value={recentOnly ? "1" : ""}
          onChange={(e) => updateFilter("recent", e.target.value)}
          className={inputClassName}
        >
          <option value="">{t("filters.allCars")}</option>
          <option value="1">{t("filters.recentOnly")}</option>
        </select>
      </FilterControl>
    </FilterBar>
  );
}

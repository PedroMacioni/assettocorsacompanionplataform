"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Search, X, ChevronDown, ChevronUp, Star, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  availableClasses: string[];
  availableBrands: string[];
  totalCars: number;
  filteredCount: number;
}

export function GarageFilters({ availableClasses, availableBrands, totalCars, filteredCount }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const search = searchParams.get("search") ?? "";
  const classFilter = searchParams.get("class") ?? "";
  const brandFilter = searchParams.get("brand") ?? "";
  const favoritesOnly = searchParams.get("favorites") === "1";
  const recentOnly = searchParams.get("recent") === "1";

  const hasActiveFilters = search || classFilter || brandFilter || favoritesOnly || recentOnly;

  const pushParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const clearAll = useCallback(() => {
    router.push("?", { scroll: false });
  }, [router]);

  return (
    <div className="space-y-3">
      {/* Search + filter toggle row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => pushParam("search", e.target.value)}
            placeholder="Buscar carro..."
            className="w-full bg-muted/60 border border-border rounded-lg pl-9 pr-8 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          {search && (
            <button
              onClick={() => pushParam("search", "")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
            filtersOpen || (hasActiveFilters && !search)
              ? "border-primary/40 bg-primary/5 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          Filtros
          {filtersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expandable filter row */}
      {filtersOpen && (
        <div className="flex flex-wrap gap-2 items-center">
          <Select
            value={classFilter}
            onChange={(v) => pushParam("class", v)}
            placeholder="Classe"
            options={availableClasses}
          />
          <Select
            value={brandFilter}
            onChange={(v) => pushParam("brand", v)}
            placeholder="Marca"
            options={availableBrands}
          />
          <Toggle
            active={favoritesOnly}
            onClick={() => pushParam("favorites", favoritesOnly ? "" : "1")}
            icon={<Star className="w-3.5 h-3.5" />}
            label="Favoritos"
          />
          <Toggle
            active={recentOnly}
            onClick={() => pushParam("recent", recentOnly ? "" : "1")}
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Sessões recentes"
          />
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {hasActiveFilters && filteredCount < totalCars && (
        <p className="text-xs text-muted-foreground">
          Exibindo <span className="font-semibold text-foreground">{filteredCount}</span> de{" "}
          <span className="font-semibold text-foreground">{totalCars}</span> carros
        </p>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "appearance-none pr-7 pl-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer",
          "focus:outline-none focus:ring-1 focus:ring-primary/40",
          value
            ? "border-primary/40 bg-primary/5 text-primary"
            : "border-border bg-card text-muted-foreground hover:text-foreground"
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
    </div>
  );
}

function Toggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/5 text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

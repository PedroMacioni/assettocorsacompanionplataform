"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Flag, Search, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistance, formatLapTime } from "@/lib/format";
import { FilterBar, FilterControl } from "@/components/FilterBar";
import { PageLoader } from "@/components/PageLoader";
import { PaginationClient } from "@/components/ui/pagination-client";
import { TrackDetailPanel } from "./TrackDetailPanel";
import type { Track } from "@/lib/types";

export type TrackWithStats = Track & {
  sessions: number;
  total_laps: number;
  total_distance_km: number;
  best_lap_ms: number | null;
};

// ── Filtros ─────────────────────────────────────────────────────────────────

const inputClassName =
  "h-9 w-full rounded-lg border border-input bg-control px-2.5 text-sm text-foreground outline-none transition-colors hover:bg-control-hover focus:border-ring focus:bg-surface-raised focus:ring-3 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60";

function TracksFilters({ availableCountries }: { availableCountries: string[] }) {
  const t = useTranslations("Tracks");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search  = searchParams.get("search")  ?? "";
  const country = searchParams.get("country") ?? "";
  const driven  = searchParams.get("driven")  ?? "";

  const activeCount = [search, country, driven].filter(Boolean).length;

  function navigate(next: URLSearchParams) {
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) { next.set(key, value); } else { next.delete(key); }
    next.delete("page");
    navigate(next);
  }

  return (
    <FilterBar
      title={t("filters.title")}
      activeLabel={activeCount > 0 ? t("filters.active", { count: activeCount }) : undefined}
      clearLabel={t("filters.clear")}
      canClear={activeCount > 0}
      onClear={() => navigate(new URLSearchParams())}
    >
      <FilterControl label={t("filters.search")} icon={<Search className="size-3" />}>
        <input
          type="text"
          value={search}
          onChange={(e) => updateFilter("search", e.target.value)}
          placeholder={t("filters.searchPlaceholder")}
          className={inputClassName}
        />
      </FilterControl>

      <FilterControl label={t("filters.country")} icon={<Globe className="size-3" />}>
        <select value={country} onChange={(e) => updateFilter("country", e.target.value)} className={inputClassName}>
          <option value="">{t("filters.allCountries")}</option>
          {availableCountries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </FilterControl>

      <FilterControl label={t("filters.status")} icon={<Flag className="size-3" />}>
        <select value={driven} onChange={(e) => updateFilter("driven", e.target.value)} className={inputClassName}>
          <option value="">{t("filters.allTracks")}</option>
          <option value="yes">{t("filters.drivenOnly")}</option>
          <option value="no">{t("filters.notYetDriven")}</option>
        </select>
      </FilterControl>
    </FilterBar>
  );
}

// ── Grid principal ───────────────────────────────────────────────────────────

interface Props {
  tracks: TrackWithStats[];
  availableCountries: string[];
  totalTracks: number;
  drivenCount: number;
  filteredCount: number;
  currentPage: number;
  totalPages: number;
  queryParams: Record<string, string | undefined>;
}

export function TracksGrid({
  tracks,
  availableCountries,
  totalTracks,
  drivenCount,
  currentPage,
  totalPages,
  queryParams,
}: Props) {
  const t = useTranslations("Tracks");
  const router = useRouter();
  const [selected, setSelected] = useState<TrackWithStats | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePageChange(page: number) {
    if (page === currentPage || isPending) return;

    const next = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) next.set(key, value);
    });
    next.set("page", String(page));

    startTransition(() => {
      router.push(`/tracks?${next.toString()}`);
    });
  }

  if (selected) {
    return <TrackDetailPanel track={selected} onClose={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("catalogue")}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        </div>

        <div className="flex w-fit items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Flag className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("results.label")}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {t("results.count", { tracks: totalTracks, driven: drivenCount })}
            </p>
          </div>
        </div>
      </div>

      <TracksFilters availableCountries={availableCountries} />

      {isPending ? (
        <div className="rounded-lg border border-border bg-card">
          <PageLoader size="md" className="min-h-[320px]" />
        </div>
      ) : (
        <>

      {/* ── Desktop: tabela ──────────────────────────────────────────── */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-card">
        <div className="apex-scroll overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border">
                {[
                  { label: t("table.track"),    right: false },
                  { label: t("table.location"), right: false },
                  { label: t("table.length"),   right: true  },
                  { label: t("table.sessions"), right: true  },
                  { label: t("table.laps"),     right: true  },
                  { label: t("table.distance"), right: true  },
                  { label: t("table.bestLap"),  right: true  },
                ].map(({ label, right }) => (
                  <th
                    key={label}
                    className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${right ? "text-right" : "text-left"}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tracks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-sm text-muted-foreground">
                    {t("noResults")}
                  </td>
                </tr>
              ) : (
                tracks.map((track) => (
                  <tr
                    key={track.track_id}
                    onClick={() => setSelected(track)}
                    className="group cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/60"
                  >
                    <td className="px-4 py-3 font-medium text-foreground transition-colors group-hover:text-primary max-w-[220px] truncate">
                      {track.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {[track.city, track.country].filter(Boolean).join(", ") || <span className="text-muted-foreground/40">--</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {track.length_km ? `${track.length_km.toFixed(3)} km` : <span className="text-muted-foreground/40">--</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {track.sessions > 0 ? track.sessions : <span className="text-muted-foreground/40">--</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {track.sessions > 0 ? track.total_laps : <span className="text-muted-foreground/40">--</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {track.sessions > 0 ? formatDistance(track.total_distance_km) : <span className="text-muted-foreground/40">--</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                      {track.sessions > 0
                        ? formatLapTime(track.best_lap_ms)
                        : <span className="text-muted-foreground/40 font-sans font-normal">--</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile: lista ────────────────────────────────────────────── */}
      <div className="md:hidden">
        {tracks.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-4 py-14 text-center text-sm text-muted-foreground">
            {t("noResults")}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
            {tracks.map((track) => (
              <button
                key={track.track_id}
                onClick={() => setSelected(track)}
                className={cn(
                  "w-full text-left px-4 py-3.5 transition-colors",
                  "hover:bg-muted/60 active:bg-muted"
                )}
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="text-sm font-semibold text-foreground truncate">{track.name}</p>
                  {track.sessions > 0 && (
                    <p className="text-sm font-bold font-mono text-foreground shrink-0">
                      {formatLapTime(track.best_lap_ms)}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-xs text-muted-foreground truncate">
                    {[track.city, track.country].filter(Boolean).join(", ") || "--"}
                  </p>
                  {track.length_km && (
                    <p className="text-[10px] text-muted-foreground shrink-0">{track.length_km.toFixed(3)} km</p>
                  )}
                </div>
                {track.sessions > 0 ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-primary font-medium">
                      {track.sessions} {track.sessions === 1 ? t("card.sessionOne") : t("card.sessionOther")}
                    </span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">{formatDistance(track.total_distance_km)}</span>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground/50">{t("card.notYetDriven")}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
        </>
      )}

      <PaginationClient
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}

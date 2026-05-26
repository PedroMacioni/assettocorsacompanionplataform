"use client";

import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { slugToName, formatDistance, formatLapTime } from "@/lib/format";
import type { TopCar, CarSpecs, UserCarPreference } from "@/lib/types";

interface Props {
  cars: TopCar[];
  specsMap: Record<string, CarSpecs>;
  prefMap: Record<string, UserCarPreference>;
  onSelect: (carId: string) => void;
}

function CarName({ car, specs, pref }: { car: TopCar; specs: CarSpecs | null; pref: UserCarPreference | null }) {
  const name = pref?.display_name ?? specs?.name ?? slugToName(car.car_id);
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <span className="truncate">{name}</span>
      {pref?.is_favorite && (
        <Star className="size-3 shrink-0 fill-yellow-400 text-yellow-400" aria-hidden="true" />
      )}
    </span>
  );
}

function ClassBadge({ label }: { label: string | null | undefined }) {
  if (!label) return <span className="text-muted-foreground/40">--</span>;
  return (
    <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary border border-primary/20">
      {label}
    </span>
  );
}

export function GarageGrid({ cars, specsMap, prefMap, onSelect }: Props) {
  const t = useTranslations("Garage");

  return (
    <>
      {/* ── Desktop: tabela ─────────────────────────────────────────────── */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-card">
        <div className="apex-scroll overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-border">
                {[
                  { label: t("table.car"),      right: false },
                  { label: t("table.class"),    right: false },
                  { label: t("table.brand"),    right: false },
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
              {cars.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-sm text-muted-foreground">
                    {t("noResults")}
                  </td>
                </tr>
              ) : (
                cars.map((car) => {
                  const specs = specsMap[car.car_id] ?? null;
                  const pref = prefMap[car.car_id] ?? null;
                  return (
                    <tr
                      key={car.car_id}
                      onClick={() => onSelect(car.car_id)}
                      className="group cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/60"
                    >
                      <td className="px-4 py-3 font-medium text-foreground transition-colors group-hover:text-primary max-w-[240px]">
                        <CarName car={car} specs={specs} pref={pref} />
                      </td>
                      <td className="px-4 py-3">
                        <ClassBadge label={specs?.class} />
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {specs?.brand ?? <span className="text-muted-foreground/40">--</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{car.sessions}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{car.total_laps}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatDistance(car.total_distance_km)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                        {formatLapTime(car.best_lap_ms)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile: lista de cards ───────────────────────────────────────── */}
      <div className="md:hidden">
        {cars.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-4 py-14 text-center text-sm text-muted-foreground">
            {t("noResults")}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
            {cars.map((car) => {
              const specs = specsMap[car.car_id] ?? null;
              const pref = prefMap[car.car_id] ?? null;
              return (
                <button
                  key={car.car_id}
                  onClick={() => onSelect(car.car_id)}
                  className={cn(
                    "w-full text-left px-4 py-3.5 transition-colors",
                    "hover:bg-muted/60 active:bg-muted"
                  )}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      <CarName car={car} specs={specs} pref={pref} />
                    </p>
                    <p className="text-sm font-bold font-mono text-foreground shrink-0">
                      {formatLapTime(car.best_lap_ms)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-xs text-muted-foreground truncate">
                      {specs?.brand ?? "--"}
                    </p>
                    <ClassBadge label={specs?.class} />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">
                      {car.sessions} {t("table.sessions").toLowerCase()}
                    </span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistance(car.total_distance_km)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

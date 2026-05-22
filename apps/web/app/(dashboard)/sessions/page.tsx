import Link from "next/link";
import { ListChecks } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { slugToName } from "@/lib/format";
import type { Session, TopCar, TopTrack } from "@/lib/types";
import { SessionsClient } from "./SessionsClient";
import { SessionsFilters, type SessionFilterOption } from "./SessionsFilters";

type SearchParams = {
  page?: string;
  car?: string;
  track?: string;
  filter?: string;
  date?: string;
  type?: string;
};

type PeriodFilter = "this_week" | "last_30_days";
type TypeRow = { session_types: string | null };

const PERIOD_FILTERS = new Set<string>(["this_week", "last_30_days"]);

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizePeriod(value?: string): PeriodFilter | undefined {
  return value && PERIOD_FILTERS.has(value) ? (value as PeriodFilter) : undefined;
}

function includeSelected(
  options: SessionFilterOption[],
  selected: string | undefined,
  labelFor: (value: string) => string
): SessionFilterOption[] {
  if (!selected || options.some((option) => option.value === selected)) return options;
  return [{ value: selected, label: labelFor(selected) }, ...options];
}

function buildPageHref(
  targetPage: number,
  params: Pick<SearchParams, "car" | "track" | "type" | "date"> & { filter?: PeriodFilter }
) {
  const next = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) next.set(key, value);
  });

  if (targetPage > 1) next.set("page", String(targetPage));

  const query = next.toString();
  return query ? `/sessions?${query}` : "/sessions";
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const t = await getTranslations("Sessions");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const period = normalizePeriod(params.filter);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user!.id;

  let query = supabase
    .from("sessions")
    .select("*", { count: "exact" })
    .eq("user_id", uid)
    .neq("session_types", "--")
    .order("started_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (params.car) query = query.eq("car_id", params.car);
  if (params.track) query = query.eq("track_id", params.track);
  if (params.type) query = query.eq("session_types", params.type);

  if (params.date) {
    const dayStart = new Date(`${params.date}T00:00:00.000Z`);
    const dayEnd = new Date(`${params.date}T23:59:59.999Z`);
    query = query.gte("started_at", dayStart.toISOString()).lte("started_at", dayEnd.toISOString());
  } else if (period === "this_week") {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    query = query.gte("started_at", weekStart.toISOString());
  } else if (period === "last_30_days") {
    const monthStart = new Date();
    monthStart.setDate(monthStart.getDate() - 30);
    monthStart.setHours(0, 0, 0, 0);
    query = query.gte("started_at", monthStart.toISOString());
  }

  const [sessionsRes, totalRes, carsRes, tracksRes, typesRes] = await Promise.all([
    query,
    supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid)
      .neq("session_types", "--"),
    supabase
      .from("top_cars")
      .select("car_id")
      .eq("user_id", uid)
      .order("sessions", { ascending: false }),
    supabase
      .from("top_tracks")
      .select("track_id")
      .eq("user_id", uid)
      .order("sessions", { ascending: false }),
    supabase
      .from("sessions")
      .select("session_types")
      .eq("user_id", uid)
      .neq("session_types", "--"),
  ]);

  const sessions = (sessionsRes.data ?? []) as Session[];
  const filteredCount = sessionsRes.count ?? 0;
  const totalCount = totalRes.count ?? filteredCount;
  const totalPages = Math.ceil(filteredCount / pageSize);

  const carOptions = includeSelected(
    ((carsRes.data ?? []) as Pick<TopCar, "car_id">[])
      .filter((row) => Boolean(row.car_id))
      .map((row) => ({ value: row.car_id, label: slugToName(row.car_id) })),
    params.car,
    slugToName
  );

  const trackOptions = includeSelected(
    ((tracksRes.data ?? []) as Pick<TopTrack, "track_id">[])
      .filter((row) => Boolean(row.track_id))
      .map((row) => ({ value: row.track_id, label: slugToName(row.track_id) })),
    params.track,
    slugToName
  );

  const typeOptions = includeSelected(
    Array.from(
      new Set(
        ((typesRes.data ?? []) as TypeRow[])
          .map((row) => row.session_types)
          .filter((value): value is string => Boolean(value) && value !== "--")
      )
    )
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: value })),
    params.type,
    (value) => value
  );

  const selectedPeriod = params.date ? undefined : period;
  const activeFilterCount = [
    params.car,
    params.track,
    params.type,
    params.date ?? selectedPeriod,
  ].filter(Boolean).length;

  if (sessions.length === 0 && page === 1 && activeFilterCount === 0) {
    return <EmptyState title={t("noSessions")} />;
  }

  const pageParams = {
    car: params.car,
    track: params.track,
    type: params.type,
    date: params.date,
    filter: selectedPeriod,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("history")}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        </div>

        <div className="flex w-fit items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ListChecks className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("results.label")}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {activeFilterCount > 0
                ? t("results.filteredCount", { count: filteredCount, total: totalCount })
                : t("results.count", { count: totalCount })}
            </p>
          </div>
        </div>
      </div>

      <SessionsFilters
        cars={carOptions}
        tracks={trackOptions}
        types={typeOptions}
        selected={{
          car: params.car,
          track: params.track,
          type: params.type,
          period: selectedPeriod,
          date: params.date,
        }}
        activeCount={activeFilterCount}
      />

      <SessionsClient sessions={sessions} />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {page > 1 && (
            <Link
              href={buildPageHref(page - 1, pageParams)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {t("previous")}
            </Link>
          )}
          <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
          {page < totalPages && (
            <Link
              href={buildPageHref(page + 1, pageParams)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {t("next")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

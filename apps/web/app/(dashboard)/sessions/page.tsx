import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { slugToName } from "@/lib/format";
import type { Session, SessionWithMeta, SessionBadge, PersonalBest, TopCar, TopTrack } from "@/lib/types";
import { SessionsContent } from "./SessionsContent";
import { type SessionFilterOption } from "./SessionsFilters";

type SearchParams = {
  page?: string;
  car?: string;
  track?: string;
  filter?: string;
  onlyPb?: string;
};

type PeriodFilter = "this_week" | "last_30_days" | "last_90_days" | "this_year";

const PERIOD_FILTERS = new Set<string>(["this_week", "last_30_days", "last_90_days", "this_year"]);

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

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const t = await getTranslations("Sessions");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = 10;
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

  if (period === "this_week") {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    query = query.gte("started_at", weekStart.toISOString());
  } else if (period === "last_30_days") {
    const monthStart = new Date();
    monthStart.setDate(monthStart.getDate() - 30);
    monthStart.setHours(0, 0, 0, 0);
    query = query.gte("started_at", monthStart.toISOString());
  } else if (period === "last_90_days") {
    const start = new Date();
    start.setDate(start.getDate() - 90);
    start.setHours(0, 0, 0, 0);
    query = query.gte("started_at", start.toISOString());
  } else if (period === "this_year") {
    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);
    query = query.gte("started_at", yearStart.toISOString());
  }

  const [sessionsRes, carsRes, tracksRes] = await Promise.all([
    query,
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
  ]);

  const rawSessions = (sessionsRes.data ?? []) as Session[];
  const filteredCount = sessionsRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));

  // Enrich sessions with deltaPbMs and badge
  const carTrackPairs = [...new Set(rawSessions.map((s) => `${s.car_id}::${s.track_id}`))];
  const pbsRes = carTrackPairs.length > 0
    ? await supabase
        .from("personal_bests")
        .select("car_id, track_id, time_ms")
        .eq("user_id", uid)
        .in("car_id", [...new Set(rawSessions.map((s) => s.car_id))])
        .in("track_id", [...new Set(rawSessions.map((s) => s.track_id))])
    : { data: [] };

  const pbMap = new Map<string, number>();
  for (const pb of (pbsRes.data ?? []) as Pick<PersonalBest, "car_id" | "track_id" | "time_ms">[]) {
    pbMap.set(`${pb.car_id}::${pb.track_id}`, pb.time_ms);
  }

  const sessions: SessionWithMeta[] = rawSessions.map((s) => {
    const pbMs = pbMap.get(`${s.car_id}::${s.track_id}`) ?? null;
    const deltaPbMs = s.best_lap_ms !== null && pbMs !== null ? s.best_lap_ms - pbMs : null;
    const badge: SessionBadge = deltaPbMs !== null && deltaPbMs <= 0 ? "new_pb" : null;
    return { ...s, deltaPbMs, badge };
  });

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

  const onlyPb = params.onlyPb === "1";
  const filteredSessions = onlyPb ? sessions.filter((s) => s.badge === "new_pb") : sessions;

  const activeFilterCount = [
    params.car,
    params.track,
    period,
    onlyPb || undefined,
  ].filter(Boolean).length;

  if (filteredSessions.length === 0 && page === 1 && activeFilterCount === 0) {
    return <EmptyState title={t("noSessions")} />;
  }

  return (
    <SessionsContent
      sessions={filteredSessions}
      cars={carOptions}
      tracks={trackOptions}
      selected={{
        car: params.car,
        track: params.track,
        period: period,
        onlyPb,
      }}
      activeFilterCount={activeFilterCount}
      currentPage={page}
      totalPages={totalPages}
      queryParams={{
        car: params.car,
        track: params.track,
        filter: period,
        onlyPb: onlyPb ? "1" : undefined,
      }}
    />
  );
}

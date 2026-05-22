import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { slugToName } from "@/lib/format";
import type { Session } from "@/lib/types";
import Link from "next/link";
import { SessionsClient } from "./SessionsClient";
import { getTranslations, getLocale } from "next-intl/server";

type SearchParams = { page?: string; car?: string; track?: string; filter?: string; date?: string };

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const t = await getTranslations("Sessions");
  const locale = await getLocale();
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const pageSize = 50;
  const from = (page - 1) * pageSize;

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

  if (params.car)   query = query.eq("car_id", params.car);
  if (params.track) query = query.eq("track_id", params.track);

  if (params.filter === "this_week") {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    query = query.gte("started_at", weekStart.toISOString());
  }

  if (params.date) {
    const dayStart = new Date(params.date + "T00:00:00.000Z");
    const dayEnd = new Date(params.date + "T23:59:59.999Z");
    query = query.gte("started_at", dayStart.toISOString()).lte("started_at", dayEnd.toISOString());
  }

  const { data, count } = await query;
  const sessions = (data ?? []) as Session[];
  const totalPages = Math.ceil((count ?? 0) / pageSize);

  if (sessions.length === 0 && page === 1 && !params.car && !params.track)
    return <EmptyState title={t("noSessions")} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            {t("history")}
          </p>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        </div>
        <span className="text-xs text-muted-foreground">{t("count", { count: count ?? 0 })}</span>
      </div>

      {/* Active filters */}
      {(params.car || params.track || params.filter || params.date) && (
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-muted-foreground">{t("filteringBy")}</span>
          {params.car && (
            <span className="px-2 py-1 bg-muted border border-border rounded text-foreground">
              {slugToName(params.car)}
            </span>
          )}
          {params.track && (
            <span className="px-2 py-1 bg-muted border border-border rounded text-foreground">
              {slugToName(params.track)}
            </span>
          )}
          {params.filter === "this_week" && (
            <span className="px-2 py-1 bg-muted border border-border rounded text-foreground">
              {t("thisWeek")}
            </span>
          )}
          {params.date && (
            <span className="px-2 py-1 bg-muted border border-border rounded text-foreground">
              {new Date(params.date + "T12:00:00Z").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
          <Link href="/sessions" className="text-primary hover:underline ml-1">
            {t("clearFilters")}
          </Link>
        </div>
      )}

      <SessionsClient sessions={sessions} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-2">
          {page > 1 && (
            <Link
              href={`/sessions?page=${page - 1}`}
              className="px-3 py-1.5 border border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
            >
              {t("previous")}
            </Link>
          )}
          <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`/sessions?page=${page + 1}`}
              className="px-3 py-1.5 border border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
            >
              {t("next")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

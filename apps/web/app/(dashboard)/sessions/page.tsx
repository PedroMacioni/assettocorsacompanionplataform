import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { slugToName } from "@/lib/format";
import type { Session } from "@/lib/types";
import Link from "next/link";
import { SessionsClient } from "./SessionsClient";

type SearchParams = { page?: string; car?: string; track?: string };

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
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

  const { data, count } = await query;
  const sessions = (data ?? []) as Session[];
  const totalPages = Math.ceil((count ?? 0) / pageSize);

  if (sessions.length === 0 && page === 1 && !params.car && !params.track)
    return <EmptyState title="Nenhuma sessão sincronizada" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Histórico
          </p>
          <h1 className="text-2xl font-bold text-foreground">Sessões</h1>
        </div>
        <span className="text-xs text-muted-foreground">{count ?? 0} sessões</span>
      </div>

      {/* Active filters */}
      {(params.car || params.track) && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Filtrando por:</span>
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
          <Link href="/sessions" className="text-primary hover:underline ml-1">
            Limpar
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
              ← Anterior
            </Link>
          )}
          <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`/sessions?page=${page + 1}`}
              className="px-3 py-1.5 border border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
            >
              Próxima →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

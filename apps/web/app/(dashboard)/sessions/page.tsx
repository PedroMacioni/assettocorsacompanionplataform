import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { LapTime } from "@/components/LapTime";
import { Pagination } from "@/components/ui/pagination";
import { formatDistance, formatDate, slugToName } from "@/lib/format";
import type { Session } from "@/lib/types";
import Link from "next/link";

type SearchParams = { page?: string; car?: string; track?: string };

const SESSION_BADGE: Record<string, string> = {
  Hotlap: "bg-primary/[0.12] text-primary border border-primary/[0.18]",
  Race: "bg-green-500/[0.12] text-green-500 border border-green-500/[0.18]",
  Practice: "bg-muted-foreground/[0.12] text-muted-foreground border border-muted-foreground/[0.18]",
  "Time Attack": "bg-blue-500/[0.12] text-blue-500 border border-blue-500/[0.18]",
};

function sessionBadge(type: string | null) {
  if (!type) return null;
  const cls = SESSION_BADGE[type] ?? "bg-muted-foreground/[0.12] text-muted-foreground border border-muted-foreground/[0.18]";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {type}
    </span>
  );
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const pageSize = 10;
  const from = (page - 1) * pageSize;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  let query = supabase
    .from("sessions")
    .select("*", { count: "exact" })
    .eq("user_id", uid)
    .order("started_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (params.car) query = query.eq("car_id", params.car);
  if (params.track) query = query.eq("track_id", params.track);

  const { data, count } = await query;
  const sessions = (data ?? []) as Session[];
  const totalPages = Math.ceil((count ?? 0) / pageSize);

  if (sessions.length === 0 && page === 1 && !params.car && !params.track)
    return <EmptyState title="No sessions synced yet" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            History
          </p>
          <h1 className="text-2xl font-bold text-foreground">Sessions</h1>
        </div>
        <span className="text-xs text-muted-foreground">{count ?? 0} total</span>
      </div>

      {/* Active filters */}
      {(params.car || params.track) && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Filtering by:</span>
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
            Clear
          </Link>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Date", "Car", "Track", "Type", "Laps", "Distance", "Best Lap"].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${
                    i >= 4 ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr
                key={s.id}
                className="border-b border-border last:border-0 hover:bg-muted transition-colors"
              >
                <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                  {formatDate(s.started_at)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/sessions/${s.source_id}`}
                    className="font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {slugToName(s.car_id)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{slugToName(s.track_id)}</td>
                <td className="px-4 py-3">{sessionBadge(s.session_types)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{s.laps}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {formatDistance(s.distance_km)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                  <LapTime ms={s.best_lap_ms} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        baseUrl="/sessions"
        queryParams={{ car: params.car, track: params.track }}
      />
    </div>
  );
}

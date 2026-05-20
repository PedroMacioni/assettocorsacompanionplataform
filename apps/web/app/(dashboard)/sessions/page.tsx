import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { LapTime } from "@/components/LapTime";
import { formatDistance, formatDate, slugToName } from "@/lib/format";
import type { Session } from "@/lib/types";
import Link from "next/link";

type SearchParams = { page?: string; car?: string; track?: string };

const SESSION_BADGE: Record<string, string> = {
  Hotlap: "bg-[#e8612a20] text-[#e8612a] border border-[#e8612a30]",
  Race: "bg-[#22c55e20] text-[#22c55e] border border-[#22c55e30]",
  Practice: "bg-[#6b6b7220] text-[#6b6b72] border border-[#6b6b7230]",
  "Time Attack": "bg-[#3b82f620] text-[#3b82f6] border border-[#3b82f630]",
};

function sessionBadge(type: string | null) {
  if (!type) return null;
  const cls = SESSION_BADGE[type] ?? "bg-[#6b6b7220] text-[#6b6b72] border border-[#6b6b7230]";
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
  const pageSize = 50;
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
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-1">
            History
          </p>
          <h1 className="text-2xl font-bold text-white">Sessions</h1>
        </div>
        <span className="text-xs text-[#6b6b72]">{count ?? 0} total</span>
      </div>

      {/* Active filters */}
      {(params.car || params.track) && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#6b6b72]">Filtering by:</span>
          {params.car && (
            <span className="px-2 py-1 bg-[#1e1e20] border border-[#2a2a2c] rounded text-white">
              {slugToName(params.car)}
            </span>
          )}
          {params.track && (
            <span className="px-2 py-1 bg-[#1e1e20] border border-[#2a2a2c] rounded text-white">
              {slugToName(params.track)}
            </span>
          )}
          <Link href="/sessions" className="text-[#e8612a] hover:underline ml-1">
            Clear
          </Link>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#161618] border border-[#2a2a2c] rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2a2c]">
              {["Date", "Car", "Track", "Type", "Laps", "Distance", "Best Lap"].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] ${
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
                className="border-b border-[#2a2a2c] last:border-0 hover:bg-[#1e1e20] transition-colors"
              >
                <td className="px-4 py-3 text-[#6b6b72] text-xs whitespace-nowrap">
                  {formatDate(s.started_at)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/sessions/${s.source_id}`}
                    className="font-medium text-white hover:text-[#e8612a] transition-colors"
                  >
                    {slugToName(s.car_id)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[#6b6b72]">{slugToName(s.track_id)}</td>
                <td className="px-4 py-3">{sessionBadge(s.session_types)}</td>
                <td className="px-4 py-3 text-right text-[#6b6b72]">{s.laps}</td>
                <td className="px-4 py-3 text-right text-[#6b6b72]">
                  {formatDistance(s.distance_km)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-white">
                  <LapTime ms={s.best_lap_ms} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-2">
          {page > 1 && (
            <Link
              href={`/sessions?page=${page - 1}`}
              className="px-3 py-1.5 border border-[#2a2a2c] rounded-md text-xs text-[#6b6b72] hover:text-white hover:border-[#e8612a] transition-colors"
            >
              ← Prev
            </Link>
          )}
          <span className="text-xs text-[#6b6b72]">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/sessions?page=${page + 1}`}
              className="px-3 py-1.5 border border-[#2a2a2c] rounded-md text-xs text-[#6b6b72] hover:text-white hover:border-[#e8612a] transition-colors"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

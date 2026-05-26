import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import type { Track, TopTrack } from "@/lib/types";
import { TracksGrid } from "./TracksGrid";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";

const PAGE_SIZE = 10;

type SearchParams = {
  search?: string;
  country?: string;
  driven?: string;
  page?: string;
};

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function TracksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const t = await getTranslations("Tracks");
  const params = await searchParams;
  const currentPage = parsePage(params.page);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const uid = user.id;

  const [userStatsRes, tracksRes] = await Promise.all([
    supabase.from("top_tracks").select("*").eq("user_id", uid).order("sessions", { ascending: false }),
    supabase.from("tracks").select("*"),
  ]);

  const userStats = (userStatsRes.data ?? []) as TopTrack[];
  const allTracks = (tracksRes.data ?? []) as Track[];

  if (allTracks.length === 0) {
    return <EmptyState title={t("empty.title")} description={t("empty.description")} />;
  }

  const statsMap = new Map(userStats.map((s) => [s.track_id, s]));

  const tracksWithStats = allTracks.map((track) => {
    const stats = statsMap.get(track.track_id);
    return {
      ...track,
      sessions: stats?.sessions ?? 0,
      total_laps: stats?.total_laps ?? 0,
      total_distance_km: stats?.total_distance_km ?? 0,
      best_lap_ms: stats?.best_lap_ms ?? null,
    };
  });

  // Driven first, then alphabetical
  const sorted = [...tracksWithStats].sort((a, b) => {
    if (a.sessions !== b.sessions) return b.sessions - a.sessions;
    return a.name.localeCompare(b.name);
  });

  // Filter
  let filtered = sorted;

  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter((t) => t.name.toLowerCase().includes(q));
  }
  if (params.country) {
    filtered = filtered.filter((t) => t.country === params.country);
  }
  if (params.driven === "yes") {
    filtered = filtered.filter((t) => t.sessions > 0);
  } else if (params.driven === "no") {
    filtered = filtered.filter((t) => t.sessions === 0);
  }

  const filteredCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const availableCountries = Array.from(
    new Set(sorted.map((t) => t.country).filter(Boolean) as string[])
  ).sort();

  const drivenCount = sorted.filter((t) => t.sessions > 0).length;

  return (
    <Suspense>
      <TracksGrid
        tracks={paginated}
        availableCountries={availableCountries}
        totalTracks={sorted.length}
        drivenCount={drivenCount}
        filteredCount={filteredCount}
        currentPage={safePage}
        totalPages={totalPages}
        queryParams={{
          search: params.search,
          country: params.country,
          driven: params.driven,
        }}
      />
    </Suspense>
  );
}

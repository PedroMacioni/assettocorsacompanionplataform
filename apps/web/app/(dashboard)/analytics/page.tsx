import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import type { ProfileSummary, Session, PersonalBest, TopCar, TopTrack } from "@/lib/types";
import { AnalyticsDashboard } from "./AnalyticsDashboard";

type SearchParams = { tab?: string };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { tab } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const twelveWeeksAgo = new Date(Date.now() - 84 * 86400000).toISOString();

  const [summaryRes, sessionsRes, carsRes, tracksRes, pbsRes] = await Promise.all([
    supabase.from("profile_summary").select("*").eq("user_id", uid).maybeSingle(),
    supabase
      .from("sessions")
      .select("started_at, best_lap_ms, track_id, car_id, session_types, laps")
      .eq("user_id", uid)
      .gte("started_at", twelveWeeksAgo)
      .order("started_at", { ascending: true }),
    supabase.from("top_cars").select("*").eq("user_id", uid).order("sessions", { ascending: false }).limit(10),
    supabase.from("top_tracks").select("*").eq("user_id", uid).order("sessions", { ascending: false }).limit(10),
    supabase.from("personal_bests").select("*").eq("user_id", uid).order("time_ms", { ascending: true }),
  ]);

  const summary = summaryRes.data as ProfileSummary | null;
  if (!summary || summary.total_sessions === 0) return <EmptyState />;

  const sessions = (sessionsRes.data ?? []) as Session[];
  const topCars = (carsRes.data ?? []) as TopCar[];
  const topTracks = (tracksRes.data ?? []) as TopTrack[];
  const personalBests = (pbsRes.data ?? []) as PersonalBest[];

  return (
    <AnalyticsDashboard
      summary={summary}
      sessions={sessions}
      topCars={topCars}
      topTracks={topTracks}
      personalBests={personalBests}
      initialTab={tab ?? "overview"}
    />
  );
}

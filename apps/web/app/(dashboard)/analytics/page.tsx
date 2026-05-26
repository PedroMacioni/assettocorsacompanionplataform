import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import {
  getProfileSummary,
  getSessionsForAnalytics,
  getTopCars,
  getTopTracks,
  getPersonalBests,
} from "@/lib/queries";
import { AnalyticsDashboard } from "./AnalyticsDashboard";

type SearchParams = { tab?: string };

// Loading skeleton
function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-1/4" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="h-80 bg-muted rounded-xl" />
    </div>
  );
}

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

  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsContent userId={uid} initialTab={tab ?? "overview"} />
    </Suspense>
  );
}

async function AnalyticsContent({
  userId,
  initialTab,
}: {
  userId: string;
  initialTab: string;
}) {
  // All queries in parallel (cached)
  const [summary, sessions, topCars, topTracks, personalBests] = await Promise.all([
    getProfileSummary(userId),
    getSessionsForAnalytics(userId, 12), // 12 weeks
    getTopCars(userId, 10),
    getTopTracks(userId, 10),
    getPersonalBests(userId),
  ]);

  if (!summary || summary.total_sessions === 0) return <EmptyState />;

  return (
    <AnalyticsDashboard
      summary={summary}
      sessions={sessions}
      topCars={topCars}
      topTracks={topTracks}
      personalBests={personalBests}
      initialTab={initialTab}
    />
  );
}

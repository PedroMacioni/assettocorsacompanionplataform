import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { slugToName } from "@/lib/format";
import type { PersonalBest } from "@/lib/types";
import { PersonalBestsTable, type EnrichedPB } from "../profile/PersonalBestsTable";

export default async function PersonalBestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("personal_bests")
    .select("*")
    .eq("user_id", user!.id)
    .order("time_ms", { ascending: true });

  const bests = (data ?? []) as PersonalBest[];

  if (bests.length === 0) return <EmptyState title="Nenhum personal best sincronizado ainda" />;

  const enrichedBests: EnrichedPB[] = bests.map((best) => ({
    ...best,
    carName: slugToName(best.car_id),
    trackName: slugToName(best.track_id),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Personal Bests</h1>
      <PersonalBestsTable records={enrichedBests} />
    </div>
  );
}

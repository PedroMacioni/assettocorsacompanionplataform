import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import type { Track, TopTrack } from "@/lib/types";
import { TracksGrid } from "./TracksGrid";

export default async function TracksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const [userStatsRes, tracksRes] = await Promise.all([
    supabase
      .from("top_tracks")
      .select("*")
      .eq("user_id", uid)
      .order("sessions", { ascending: false }),
    supabase
      .from("tracks")
      .select("*")
      .order("name", { ascending: true }),
  ]);

  const userStats = (userStatsRes.data ?? []) as TopTrack[];
  const tracks = (tracksRes.data ?? []) as Track[];

  if (tracks.length === 0) {
    return (
      <EmptyState
        title="No tracks found"
        description="Sync your agent to populate the track catalogue from your AC installation."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Catalogue
          </p>
          <h1 className="text-2xl font-bold text-foreground">Tracks</h1>
        </div>
        <span className="text-xs text-muted-foreground">
          {tracks.length} tracks · {userStats.length} driven
        </span>
      </div>

      <TracksGrid tracks={tracks} userStats={userStats} />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import type { Track, TopTrack } from "@/lib/types";
import { TracksGrid } from "./TracksGrid";
import { getTranslations } from "next-intl/server";

export default async function TracksPage() {
  const t = await getTranslations("Tracks");
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
        title={t("empty.title")}
        description={t("empty.description")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            {t("catalogue")}
          </p>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        </div>
        <span className="text-xs text-muted-foreground">
          {t("count", { tracks: tracks.length, driven: userStats.length })}
        </span>
      </div>

      <TracksGrid tracks={tracks} userStats={userStats} translations={{
        length: t("modal.length"),
        pitboxes: t("modal.pitboxes"),
        direction: t("modal.direction"),
        mySessions: t("modal.mySessions"),
        myStats: t("modal.myStats"),
        laps: t("modal.laps"),
        distance: t("modal.distance"),
        bestLap: t("modal.bestLap"),
        sessionOne: t("card.sessionOne"),
        sessionOther: t("card.sessionOther"),
        notYetDriven: t("card.notYetDriven"),
      }} />
    </div>
  );
}

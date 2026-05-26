import { getTranslations, getLocale } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ActivityCalendar } from "@/components/dashboard/ActivityCalendar";
import { QuickStatsBar } from "@/components/dashboard/QuickStatsBar";
import { PersonalBestsTable } from "./PersonalBestsTable";
import type { EnrichedPB } from "./PersonalBestsTable";
import { ProfileFavoritesSection } from "./ProfileFavoritesSection";
import type { FavoriteCarInfo, FavoriteTrackInfo } from "./ProfileFavoritesSection";
import { formatLapTime, slugToName } from "@/lib/format";
import type { ProfileSummary, PersonalBest, CarSpecs, Track } from "@/lib/types";

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function ProfileAvatar({
  name,
  avatarUrl,
  avatarColor,
  size,
}: {
  name: string;
  avatarUrl: string | null;
  avatarColor: string;
  size: number;
}) {
  const parts = name.trim().split(/\s+/);
  const letters =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase() || "DR";

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className="rounded-full object-cover border-2 border-border shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 border-2"
      style={{
        width: size,
        height: size,
        backgroundColor: `${avatarColor}18`,
        borderColor: `${avatarColor}50`,
      }}
    >
      <span
        className="font-bold"
        style={{ fontSize: Math.round(size * 0.3), color: avatarColor }}
      >
        {letters}
      </span>
    </div>
  );
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const t = await getTranslations("Profile");
  const tCommon = await getTranslations("Common");
  const locale = await getLocale();

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return tCommon("timeAgo.daysAgo", { count: days });
    if (hrs > 0) return tCommon("timeAgo.hoursAgo", { count: hrs });
    if (mins > 0) return tCommon("timeAgo.minutesAgo", { count: mins });
    return tCommon("timeAgo.now");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const displayName =
    user!.user_metadata?.display_name ??
    user!.email?.split("@")[0] ??
    "Driver";
  const avatarUrl = (user!.user_metadata?.avatar_url as string | null) ?? null;
  const avatarColor =
    (user!.user_metadata?.avatar_color as string | null) ?? "#e8612a";
  const memberSince = new Date(user!.created_at).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

  // ── Batch 1: independent queries ──────────────────────────────────────────
  const [summaryRes, pbsRes, favCarPrefRes, profileRes, activityRes] =
    await Promise.all([
      supabase
        .from("profile_summary")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle(),
      supabase
        .from("personal_bests")
        .select("*")
        .eq("user_id", uid)
        .order("time_ms", { ascending: true }),
      supabase
        .from("user_car_preferences")
        .select("car_id, display_name, is_favorite")
        .eq("user_id", uid)
        .eq("is_favorite", true)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("favorite_track_id")
        .eq("id", uid)
        .maybeSingle(),
      supabase
        .from("sessions")
        .select("started_at")
        .eq("user_id", uid)
        .gte("started_at", ninetyDaysAgo.toISOString()),
    ]);

  const summary = summaryRes.data as ProfileSummary | null;
  const pbs = (pbsRes.data ?? []) as PersonalBest[];
  const favCarPref = favCarPrefRes.data as {
    car_id: string;
    display_name: string | null;
    is_favorite: boolean;
  } | null;
  const favoriteTrackId =
    (profileRes.data?.favorite_track_id as string | null) ?? null;

  // ── Batch 2: enrichment ────────────────────────────────────────────────────
  const uniqueCarIds = [...new Set(pbs.map((pb) => pb.car_id))];
  const uniqueTrackIds = [...new Set(pbs.map((pb) => pb.track_id))];

  if (favCarPref && !uniqueCarIds.includes(favCarPref.car_id)) {
    uniqueCarIds.push(favCarPref.car_id);
  }
  if (favoriteTrackId && !uniqueTrackIds.includes(favoriteTrackId)) {
    uniqueTrackIds.push(favoriteTrackId);
  }

  type CarRow = Pick<CarSpecs, "car_id" | "name" | "brand" | "class">;
  type TrackRow = Pick<Track, "track_id" | "name" | "country">;

  const [carSpecsRes, tracksRes, favCarStatsRes, favTrackStatsRes] =
    await Promise.all([
      uniqueCarIds.length > 0
        ? supabase
            .from("car_specs")
            .select("car_id, name, brand, class")
            .in("car_id", uniqueCarIds)
        : Promise.resolve({ data: [] as CarRow[] }),
      uniqueTrackIds.length > 0
        ? supabase
            .from("tracks")
            .select("track_id, name, country")
            .in("track_id", uniqueTrackIds)
        : Promise.resolve({ data: [] as TrackRow[] }),
      favCarPref
        ? supabase
            .from("top_cars")
            .select("*")
            .eq("user_id", uid)
            .eq("car_id", favCarPref.car_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      favoriteTrackId
        ? supabase
            .from("top_tracks")
            .select("*")
            .eq("user_id", uid)
            .eq("track_id", favoriteTrackId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const carSpecsData = (carSpecsRes.data ?? []) as CarRow[];
  const tracksData = (tracksRes.data ?? []) as TrackRow[];

  const carNameMap = new Map<string, string>(
    carSpecsData.map((c) => [c.car_id, c.name])
  );
  const trackNameMap = new Map<string, string>(
    tracksData.map((tr) => [tr.track_id, tr.name])
  );

  // ── Build favorite car info ────────────────────────────────────────────────
  const favCarSpec = carSpecsData.find((c) => c.car_id === favCarPref?.car_id) ?? null;
  const favCarStats = favCarStatsRes.data as {
    sessions: number;
    total_laps: number;
    best_lap_ms: number | null;
  } | null;

  const favCarInfo: FavoriteCarInfo =
    favCarPref && favCarStats
      ? {
          carId: favCarPref.car_id,
          displayName:
            favCarPref.display_name ??
            favCarSpec?.name ??
            slugToName(favCarPref.car_id),
          brand: favCarSpec?.brand ?? null,
          carClass: favCarSpec?.class ?? null,
          sessions: favCarStats.sessions,
          totalLaps: favCarStats.total_laps,
          bestLapMs: favCarStats.best_lap_ms,
        }
      : null;

  // ── Build favorite track info ──────────────────────────────────────────────
  const favTrackInfo2 = tracksData.find((tr) => tr.track_id === favoriteTrackId) ?? null;
  const favTrackStats = favTrackStatsRes.data as {
    sessions: number;
    total_laps: number;
    best_lap_ms: number | null;
  } | null;

  const favTrackInfo: FavoriteTrackInfo =
    favoriteTrackId && favTrackStats
      ? {
          trackId: favoriteTrackId,
          name: favTrackInfo2?.name ?? slugToName(favoriteTrackId),
          country: favTrackInfo2?.country ?? null,
          sessions: favTrackStats.sessions,
          totalLaps: favTrackStats.total_laps,
          bestLapMs: favTrackStats.best_lap_ms,
        }
      : null;

  // ── Activity calendar ──────────────────────────────────────────────────────
  const activityMap = new Map<string, number>();
  (activityRes.data ?? []).forEach((s: { started_at: string }) => {
    const date = s.started_at.split("T")[0];
    activityMap.set(date, (activityMap.get(date) ?? 0) + 1);
  });
  const activityData = Array.from(activityMap.entries()).map(
    ([date, count]) => ({ date, count })
  );

  const weekdayDist = Array(7).fill(0) as number[];
  (activityRes.data ?? []).forEach((s: { started_at: string }) => {
    weekdayDist[new Date(s.started_at).getDay()]++;
  });

  // ── Enrich personal bests ──────────────────────────────────────────────────
  const enrichedPbs: EnrichedPB[] = pbs.map((pb) => ({
    ...pb,
    carName: carNameMap.get(pb.car_id) ?? slugToName(pb.car_id),
    trackName: trackNameMap.get(pb.track_id) ?? slugToName(pb.track_id),
  }));

  return (
    <div className="space-y-6">
      {/* HEADER ──────────────────────────────────────────────────────────── */}
      <div className="animate-in fade-in duration-500">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          {t("title")}
        </p>
        <h1 className="text-2xl font-bold text-foreground mb-5">{displayName}</h1>

        <div className="bg-card border border-border rounded-md p-5">
          <div className="flex items-start gap-5">
            <ProfileAvatar
              name={displayName}
              avatarUrl={avatarUrl}
              avatarColor={avatarColor}
              size={72}
            />
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-foreground leading-tight">
                {displayName}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">{user!.email}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-2">
                <span className="text-xs text-muted-foreground">
                  {t("memberSince", { date: memberSince })}
                </span>
                {summary?.last_session_at && (
                  <span className="text-xs text-muted-foreground">
                    · {t("lastSession", { time: timeAgo(summary.last_session_at) })}
                  </span>
                )}
              </div>
              {summary && (
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-3">
                  {[
                    {
                      value: summary.total_sessions.toLocaleString(locale),
                      label: t("sessions"),
                    },
                    {
                      value: summary.total_laps.toLocaleString(locale),
                      label: t("laps"),
                    },
                    ...(summary.fastest_lap_ms
                      ? [
                          {
                            value: formatLapTime(summary.fastest_lap_ms),
                            label: t("bestLap"),
                          },
                        ]
                      : []),
                  ].map(({ value, label }) => (
                    <div key={label} className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-foreground font-mono">
                        {value}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Link
              href="/settings"
              className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("editProfile")}
            </Link>
          </div>
        </div>
      </div>

      {summary && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
          <QuickStatsBar
            tracks={summary.unique_tracks}
            cars={summary.unique_cars}
            distanceKm={summary.total_distance_km}
            laps={summary.total_laps}
          />
        </div>
      )}

      {/* FAVORITOS ───────────────────────────────────────────────────────── */}
      <SectionDivider label={t("sectionFavorites")} />

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
        <ProfileFavoritesSection
          userId={uid}
          initialFavCar={favCarInfo}
          initialFavTrack={favTrackInfo}
        />
      </div>

      {/* RECORDS PESSOAIS ────────────────────────────────────────────────── */}
      <SectionDivider label={t("sectionRecords")} />

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
        <PersonalBestsTable records={enrichedPbs} />
      </div>

      {/* ATIVIDADE ───────────────────────────────────────────────────────── */}
      <SectionDivider label={t("sectionActivity")} />

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
        <ActivityCalendar
          sessions={activityData}
          daysToShow={90}
          weekdayDist={weekdayDist}
        />
      </div>
    </div>
  );
}

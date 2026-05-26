import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star, Car, MapPin } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ActivityCalendar } from "@/components/dashboard/ActivityCalendar";
import { PersonalBestsTable } from "@/app/(dashboard)/profile/PersonalBestsTable";
import type { EnrichedPB } from "@/app/(dashboard)/profile/PersonalBestsTable";
import { FriendSessionsSection } from "./FriendSessionsSection";
import { formatLapTime, formatDistance, slugToName } from "@/lib/format";
import type { ProfileSummary, PersonalBest, CarSpecs, Track, Session } from "@/lib/types";

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

export default async function FriendProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
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
  if (!user) redirect("/login");

  // Load target profile by username
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, avatar_color, country, created_at, profile_visibility, favorite_track_id")
    .eq("username", username)
    .maybeSingle();

  if (!targetProfile) notFound();

  // Redirect to own profile if viewing yourself
  if (targetProfile.id === user.id) redirect("/profile");

  // Verify friendship
  const { data: friendship } = await supabase
    .from("friendships")
    .select("status")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${targetProfile.id}),and(requester_id.eq.${targetProfile.id},addressee_id.eq.${user.id})`
    )
    .eq("status", "accepted")
    .maybeSingle();

  if (!friendship) notFound();

  const targetId = targetProfile.id;
  const displayName = targetProfile.display_name || targetProfile.username || "Driver";
  const avatarColor = (targetProfile.avatar_color as string | null) ?? "#e8612a";
  const memberSince = new Date(targetProfile.created_at).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

  const favoriteTrackId = (targetProfile.favorite_track_id as string | null) ?? null;

  const [summaryRes, pbsRes, activityRes, recentSessionsRes, favCarPrefRes] = await Promise.all([
    supabase.from("profile_summary").select("*").eq("user_id", targetId).maybeSingle(),
    supabase.from("personal_bests").select("*").eq("user_id", targetId).order("time_ms", { ascending: true }),
    supabase.from("sessions").select("started_at").eq("user_id", targetId).gte("started_at", ninetyDaysAgo.toISOString()),
    supabase.from("sessions").select("*").eq("user_id", targetId).order("started_at", { ascending: false }).limit(20),
    supabase.from("user_car_preferences").select("car_id, display_name").eq("user_id", targetId).eq("is_favorite", true).limit(1).maybeSingle(),
  ]);

  const summary = summaryRes.data as ProfileSummary | null;
  const pbs = (pbsRes.data ?? []) as PersonalBest[];
  const recentSessions = (recentSessionsRes.data ?? []) as Session[];
  const favCarPref = favCarPrefRes.data as { car_id: string; display_name: string | null } | null;

  // Collect all IDs for enrichment
  const uniqueCarIds = [...new Set([
    ...pbs.map((pb) => pb.car_id),
    ...recentSessions.map((s) => s.car_id),
    ...(favCarPref ? [favCarPref.car_id] : []),
  ])];
  const uniqueTrackIds = [...new Set([
    ...pbs.map((pb) => pb.track_id),
    ...recentSessions.map((s) => s.track_id),
    ...(favoriteTrackId ? [favoriteTrackId] : []),
  ])];

  type CarRow = Pick<CarSpecs, "car_id" | "name" | "brand" | "class">;
  type TrackRow = Pick<Track, "track_id" | "name" | "country">;

  const [carSpecsRes, tracksRes, favCarStatsRes, favTrackStatsRes] = await Promise.all([
    uniqueCarIds.length > 0
      ? supabase.from("car_specs").select("car_id, name, brand, class").in("car_id", uniqueCarIds)
      : Promise.resolve({ data: [] as CarRow[] }),
    uniqueTrackIds.length > 0
      ? supabase.from("tracks").select("track_id, name, country").in("track_id", uniqueTrackIds)
      : Promise.resolve({ data: [] as TrackRow[] }),
    favCarPref
      ? supabase.from("top_cars").select("sessions, total_laps, best_lap_ms").eq("user_id", targetId).eq("car_id", favCarPref.car_id).maybeSingle()
      : Promise.resolve({ data: null }),
    favoriteTrackId
      ? supabase.from("top_tracks").select("sessions, total_laps, best_lap_ms").eq("user_id", targetId).eq("track_id", favoriteTrackId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const carSpecsData = (carSpecsRes.data ?? []) as CarRow[];
  const tracksData = (tracksRes.data ?? []) as TrackRow[];

  const carNameMap = new Map<string, string>(carSpecsData.map((c) => [c.car_id, c.name]));
  const trackNameMap = new Map<string, string>(tracksData.map((tr) => [tr.track_id, tr.name]));

  const carNamesRecord = Object.fromEntries(carNameMap);
  const trackNamesRecord = Object.fromEntries(trackNameMap);

  // Favorite car
  const favCarSpec = carSpecsData.find((c) => c.car_id === favCarPref?.car_id) ?? null;
  const favCarStats = favCarStatsRes.data as { sessions: number; total_laps: number; best_lap_ms: number | null } | null;
  const favCar = favCarPref && favCarStats
    ? {
        displayName: favCarPref.display_name ?? favCarSpec?.name ?? slugToName(favCarPref.car_id),
        brand: favCarSpec?.brand ?? null,
        carClass: (favCarSpec as { class?: string | null } | null)?.class ?? null,
        sessions: favCarStats.sessions,
        totalLaps: favCarStats.total_laps,
        bestLapMs: favCarStats.best_lap_ms,
      }
    : null;

  // Favorite track
  const favTrackData = tracksData.find((tr) => tr.track_id === favoriteTrackId) ?? null;
  const favTrackStats = favTrackStatsRes.data as { sessions: number; total_laps: number; best_lap_ms: number | null } | null;
  const favTrack = favoriteTrackId && favTrackStats
    ? {
        name: favTrackData?.name ?? slugToName(favoriteTrackId),
        country: favTrackData?.country ?? null,
        sessions: favTrackStats.sessions,
        totalLaps: favTrackStats.total_laps,
        bestLapMs: favTrackStats.best_lap_ms,
      }
    : null;

  const enrichedPbs: EnrichedPB[] = pbs.map((pb) => ({
    ...pb,
    carName: carNameMap.get(pb.car_id) ?? slugToName(pb.car_id),
    trackName: trackNameMap.get(pb.track_id) ?? slugToName(pb.track_id),
  }));

  // Activity calendar
  const activityMap = new Map<string, number>();
  (activityRes.data ?? []).forEach((s: { started_at: string }) => {
    const date = s.started_at.split("T")[0];
    activityMap.set(date, (activityMap.get(date) ?? 0) + 1);
  });
  const activityData = Array.from(activityMap.entries()).map(([date, count]) => ({ date, count }));
  const weekdayDist = Array(7).fill(0) as number[];
  (activityRes.data ?? []).forEach((s: { started_at: string }) => {
    weekdayDist[new Date(s.started_at).getDay()]++;
  });

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="animate-in fade-in duration-300">
        <Link
          href="/friends"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("backToFriends")}
        </Link>
      </div>

      {/* Header */}
      <div className="animate-in fade-in duration-500">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          {t("title")}
        </p>
        <h1 className="text-2xl font-bold text-foreground mb-5">{displayName}</h1>

        <div className="bg-card border border-border rounded-md p-5">
          <div className="flex items-start gap-5">
            <ProfileAvatar
              name={displayName}
              avatarUrl={targetProfile.avatar_url}
              avatarColor={avatarColor}
              size={72}
            />
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-foreground leading-tight">{displayName}</p>
              {targetProfile.username && (
                <p className="text-sm text-muted-foreground mt-0.5">@{targetProfile.username}</p>
              )}
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
                    { value: summary.total_sessions.toLocaleString(locale), label: t("sessions") },
                    { value: summary.total_laps.toLocaleString(locale), label: t("laps") },
                    ...(summary.fastest_lap_ms
                      ? [{ value: formatLapTime(summary.fastest_lap_ms), label: t("bestLap") }]
                      : []),
                  ].map(({ value, label }) => (
                    <div key={label} className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-foreground font-mono">{value}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {summary && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
          <div className="bg-card border border-border rounded-md p-4">
            <div className="grid grid-cols-2 md:grid-cols-4">
              {[
                { value: summary.unique_tracks.toString(), label: t("uniqueTracks") },
                { value: summary.unique_cars.toString(), label: t("uniqueCars") },
                { value: formatDistance(summary.total_distance_km), label: t("kmDriven") },
                { value: summary.total_laps.toLocaleString(locale), label: t("laps") },
              ].map(({ value, label }, i) => (
                <div
                  key={label}
                  className={[
                    "flex flex-col items-center text-center py-3 md:py-0",
                    i > 0 ? "md:pl-4 md:border-l md:border-border" : "",
                    i >= 2 ? "border-t border-border md:border-t-0" : "",
                  ].join(" ")}
                >
                  <span className="text-xl font-semibold text-foreground">{value}</span>
                  <span className="text-xs text-muted-foreground mt-1">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Favorites */}
      {(favCar || favTrack) && (
        <>
          <SectionDivider label={t("sectionFavorites")} />
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {favCar ? (
                <div className="bg-card border border-border rounded-md p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("favoriteCar")}
                    </p>
                  </div>
                  <p className="text-base font-bold text-foreground leading-tight">{favCar.displayName}</p>
                  {(favCar.brand || favCar.carClass) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[favCar.brand, favCar.carClass].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
                    {[
                      { label: t("sessions"), value: favCar.sessions.toLocaleString(locale) },
                      { label: t("laps"), value: favCar.totalLaps > 0 ? favCar.totalLaps.toLocaleString(locale) : "—" },
                      { label: t("bestLap"), value: formatLapTime(favCar.bestLapMs) },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-bold text-foreground font-mono mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-md p-5 flex flex-col items-center justify-center gap-3 text-center min-h-[160px]">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Car className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t("noFavoriteCar")}</p>
                </div>
              )}

              {favTrack ? (
                <div className="bg-card border border-border rounded-md p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("favoriteTrack")}
                    </p>
                  </div>
                  <p className="text-base font-bold text-foreground leading-tight">{favTrack.name}</p>
                  {favTrack.country && (
                    <p className="text-xs text-muted-foreground mt-0.5">{favTrack.country}</p>
                  )}
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
                    {[
                      { label: t("sessions"), value: favTrack.sessions.toLocaleString(locale) },
                      { label: t("laps"), value: favTrack.totalLaps > 0 ? favTrack.totalLaps.toLocaleString(locale) : "—" },
                      { label: t("bestLap"), value: formatLapTime(favTrack.bestLapMs) },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-bold text-foreground font-mono mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-md p-5 flex flex-col items-center justify-center gap-3 text-center min-h-[160px]">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t("noFavoriteTrack")}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Recent Sessions */}
      <SectionDivider label={t("sectionRecentSessions")} />
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
        <FriendSessionsSection
          sessions={recentSessions}
          targetUserId={targetId}
          carNames={carNamesRecord}
          trackNames={trackNamesRecord}
        />
      </div>

      {/* Personal Bests */}
      <SectionDivider label={t("sectionRecords")} />
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
        <PersonalBestsTable records={enrichedPbs} />
      </div>

      {/* Activity */}
      <SectionDivider label={t("sectionActivity")} />
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
        <ActivityCalendar
          sessions={activityData}
          daysToShow={90}
          weekdayDist={weekdayDist}
          disableLinks
        />
      </div>
    </div>
  );
}

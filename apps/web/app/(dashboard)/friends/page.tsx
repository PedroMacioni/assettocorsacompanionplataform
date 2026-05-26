import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { FriendsClient, type FriendListItem } from "./FriendsClient";
import type { FriendshipRow, SocialProfile } from "./actions";

const PROFILE_SELECT = "id, username, display_name, country, avatar_url, avatar_color";

function fallbackProfile(id: string): SocialProfile {
  return { id, username: null, display_name: "Driver", country: null, avatar_url: null, avatar_color: "#e8612a" };
}

export default async function FriendsPage() {
  const t = await getTranslations("Friends");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const uid = user.id;

  const { data: friendshipRows, error } = await supabase
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (friendshipRows ?? []) as FriendshipRow[];
  const relatedIds = Array.from(
    new Set(rows.map((row) => row.requester_id === uid ? row.addressee_id : row.requester_id))
  );
  const acceptedIds = rows
    .filter((r) => r.status === "accepted")
    .map((r) => r.requester_id === uid ? r.addressee_id : r.requester_id);

  const [profilesRes, summaryRes] = await Promise.all([
    relatedIds.length > 0
      ? supabase.from("profiles").select(PROFILE_SELECT).in("id", relatedIds)
      : Promise.resolve({ data: [] as SocialProfile[], error: null }),
    acceptedIds.length > 0
      ? supabase.from("profile_summary").select("user_id, total_sessions, total_laps, fastest_lap_ms").in("user_id", acceptedIds)
      : Promise.resolve({ data: [] as { user_id: string; total_sessions: number; total_laps: number; fastest_lap_ms: number | null }[], error: null }),
  ]);

  const profiles = new Map(
    ((profilesRes.data ?? []) as SocialProfile[]).map((p) => [p.id, p])
  );
  const summaries = new Map(
    ((summaryRes.data ?? []) as { user_id: string; total_sessions: number; total_laps: number; fastest_lap_ms: number | null }[])
      .map((s) => [s.user_id, s])
  );

  const items: FriendListItem[] = rows.map((row) => {
    const otherId = row.requester_id === uid ? row.addressee_id : row.requester_id;
    const s = summaries.get(otherId);
    return {
      friendshipId: row.id,
      status: row.status,
      direction: row.requester_id === uid ? "outgoing" : "incoming",
      createdAt: row.created_at,
      profile: profiles.get(otherId) ?? fallbackProfile(otherId),
      summary: s
        ? { total_sessions: s.total_sessions, total_laps: s.total_laps, fastest_lap_ms: s.fastest_lap_ms }
        : undefined,
    };
  });

  return (
    <FriendsClient
      title={t("title")}
      eyebrow={t("eyebrow")}
      description={t("description")}
      initialFriends={items.filter((i) => i.status === "accepted")}
      initialIncoming={items.filter((i) => i.status === "pending" && i.direction === "incoming")}
      initialOutgoing={items.filter((i) => i.status === "pending" && i.direction === "outgoing")}
    />
  );
}

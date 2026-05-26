"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FriendshipStatus = "pending" | "accepted" | "declined" | "blocked";
export type FriendshipDirection = "incoming" | "outgoing";

export type SocialProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  country: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
};

export type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  responded_at: string | null;
};

export type FriendSearchResult = SocialProfile & {
  friendshipId: string | null;
  friendshipStatus: FriendshipStatus | null;
  friendshipDirection: FriendshipDirection | null;
};

const PROFILE_SELECT = "id, username, display_name, country, avatar_url, avatar_color";

async function getUserId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user.id;
}

function relationDirection(row: FriendshipRow, userId: string): FriendshipDirection {
  return row.requester_id === userId ? "outgoing" : "incoming";
}

async function findFriendship(userId: string, targetUserId: string): Promise<FriendshipRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${userId})`
    )
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as FriendshipRow | null;
}

export async function searchUsers(query: string): Promise<FriendSearchResult[]> {
  const userId = await getUserId();
  const supabase = await createClient();
  const q = query.trim().replace(/[%,()]/g, "").slice(0, 48);

  if (q.length < 2) return [];

  const pattern = `%${q}%`;
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .neq("id", userId)
    .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
    .order("display_name", { ascending: true, nullsFirst: false })
    .limit(12);

  if (error) throw error;

  const results = (profiles ?? []) as SocialProfile[];
  if (results.length === 0) return [];

  const ids = results.map((profile) => profile.id);
  const { data: friendships, error: friendshipsError } = await supabase
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .in("requester_id", [userId, ...ids]);

  if (friendshipsError) throw friendshipsError;

  const relations = ((friendships ?? []) as FriendshipRow[]).filter((row) =>
    ids.includes(row.requester_id === userId ? row.addressee_id : row.requester_id)
  );
  const relationByUserId = new Map<string, FriendshipRow>();

  for (const relation of relations) {
    const otherId = relation.requester_id === userId ? relation.addressee_id : relation.requester_id;
    relationByUserId.set(otherId, relation);
  }

  return results.map((profile) => {
    const relation = relationByUserId.get(profile.id) ?? null;
    return {
      ...profile,
      friendshipId: relation?.id ?? null,
      friendshipStatus: relation?.status ?? null,
      friendshipDirection: relation ? relationDirection(relation, userId) : null,
    };
  });
}

export async function sendFriendRequest(targetUserId: string): Promise<void> {
  const userId = await getUserId();
  if (targetUserId === userId) throw new Error("Cannot add yourself");

  const supabase = await createClient();
  const existing = await findFriendship(userId, targetUserId);

  if (existing?.status === "blocked") {
    throw new Error("This friendship is blocked");
  }

  if (existing?.status === "pending" || existing?.status === "accepted") {
    return;
  }

  if (existing) {
    const { error } = await supabase
      .from("friendships")
      .update({
        requester_id: userId,
        addressee_id: targetUserId,
        status: "pending",
        created_at: new Date().toISOString(),
        responded_at: null,
      })
      .eq("id", existing.id);

    if (error) throw error;
  } else {
    const { error } = await supabase.from("friendships").insert({
      requester_id: userId,
      addressee_id: targetUserId,
      status: "pending",
    });

    if (error) throw error;
  }

  revalidatePath("/friends");
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const userId = await getUserId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", friendshipId)
    .eq("addressee_id", userId)
    .eq("status", "pending");

  if (error) throw error;
  revalidatePath("/friends");
}

export async function declineFriendRequest(friendshipId: string): Promise<void> {
  const userId = await getUserId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("friendships")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", friendshipId)
    .eq("addressee_id", userId)
    .eq("status", "pending");

  if (error) throw error;
  revalidatePath("/friends");
}

export async function removeFriend(friendshipId: string): Promise<void> {
  const userId = await getUserId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId)
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (error) throw error;
  revalidatePath("/friends");
}

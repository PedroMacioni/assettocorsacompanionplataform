"use server";

import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Revalidate all cached data for a user.
 * Call this after syncing data from the Agent.
 */
export async function revalidateUserData(userId?: string) {
  // If no userId provided, get it from the current session
  let uid = userId;
  if (!uid) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    uid = user?.id;
  }

  if (!uid) {
    throw new Error("User not authenticated");
  }

  // Invalidate all cache tags for this user
  updateTag(`user:${uid}`);
}

/**
 * Revalidate specific data types for a user.
 */
export async function revalidateUserSessions(userId: string) {
  updateTag(`user:${userId}:sessions`);
  updateTag(`user:${userId}:summary`);
}

export async function revalidateUserPBs(userId: string) {
  updateTag(`user:${userId}:pbs`);
  updateTag(`user:${userId}:summary`);
}

export async function revalidateUserCars(userId: string) {
  updateTag(`user:${userId}:cars`);
}

export async function revalidateUserTracks(userId: string) {
  updateTag(`user:${userId}:tracks`);
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CarSpecs, CarSetup } from "@/lib/types";

export async function updateCarDisplayName(carId: string, displayName: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const trimmed = displayName.trim();

  if (trimmed) {
    await supabase.from("user_car_preferences").upsert({
      user_id: user.id,
      car_id: carId,
      display_name: trimmed,
      updated_at: new Date().toISOString(),
    });
  } else {
    await supabase
      .from("user_car_preferences")
      .delete()
      .eq("user_id", user.id)
      .eq("car_id", carId);
  }

  revalidatePath("/garage");
}

export async function toggleCarFavorite(carId: string, isFavorite: boolean): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.from("user_car_preferences").upsert({
    user_id: user.id,
    car_id: carId,
    is_favorite: isFavorite,
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/garage");
}

export type CarModalData = {
  specs: CarSpecs | null;
  tracks: { track_id: string; name: string; best_lap_ms: number | null; sessions: number }[];
  setups: CarSetup[];
};

export async function getCarModalData(carId: string): Promise<CarModalData> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [specsRes, sessionsRes, setupsRes] = await Promise.all([
    supabase.from("car_specs").select("*").eq("car_id", carId).maybeSingle(),
    supabase
      .from("sessions")
      .select("track_id")
      .eq("user_id", user.id)
      .eq("car_id", carId),
    supabase
      .from("car_setups")
      .select("*")
      .eq("user_id", user.id)
      .eq("car_id", carId)
      .order("updated_at", { ascending: false }),
  ]);

  const trackIds = Array.from(new Set((sessionsRes.data ?? []).map((s) => s.track_id)));

  const [pbsRes, trackSessionCountsRes] = await Promise.all([
    trackIds.length > 0
      ? supabase
          .from("personal_bests")
          .select("track_id, time_ms")
          .eq("user_id", user.id)
          .eq("car_id", carId)
          .in("track_id", trackIds)
      : Promise.resolve({ data: [] }),
    trackIds.length > 0
      ? supabase
          .from("sessions")
          .select("track_id")
          .eq("user_id", user.id)
          .eq("car_id", carId)
          .in("track_id", trackIds)
      : Promise.resolve({ data: [] }),
  ]);

  const pbMap: Record<string, number> = {};
  for (const pb of pbsRes.data ?? []) {
    pbMap[pb.track_id] = pb.time_ms;
  }

  const sessionCountMap: Record<string, number> = {};
  for (const s of trackSessionCountsRes.data ?? []) {
    sessionCountMap[s.track_id] = (sessionCountMap[s.track_id] ?? 0) + 1;
  }

  const tracks = trackIds.map((tid) => ({
    track_id: tid,
    name: tid,
    best_lap_ms: pbMap[tid] ?? null,
    sessions: sessionCountMap[tid] ?? 0,
  })).sort((a, b) => b.sessions - a.sessions);

  return {
    specs: specsRes.data as CarSpecs | null,
    tracks,
    setups: (setupsRes.data ?? []) as CarSetup[],
  };
}

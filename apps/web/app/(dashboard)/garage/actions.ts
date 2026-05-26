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

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type CarTrack = {
  track_id: string;
  best_lap_ms: number | null;
  sessions: number;
  last_played_at: string | null;
};

export type CarTracksPage = {
  tracks: CarTrack[];
  total: number;
  totalPages: number;
  page: number;
};

export type CarModalData = {
  specs: CarSpecs | null;
  setups: CarSetup[];
};

// ─── Actions ─────────────────────────────────────────────────────────────────

const TRACKS_PAGE_SIZE = 10;

const normalize = (s: string) => s.toLowerCase().replace(/[_\-]/g, " ");

export async function getCarTracks(carId: string, page: number, search?: string): Promise<CarTracksPage> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("track_id, started_at")
    .eq("user_id", user.id)
    .eq("car_id", carId)
    .order("started_at", { ascending: false });

  const orderedIds: string[] = [];
  const seen = new Set<string>();
  const countMap: Record<string, number> = {};
  const lastPlayedMap: Record<string, string> = {};

  for (const s of sessionRows ?? []) {
    countMap[s.track_id] = (countMap[s.track_id] ?? 0) + 1;
    if (!seen.has(s.track_id)) {
      seen.add(s.track_id);
      orderedIds.push(s.track_id);
      lastPlayedMap[s.track_id] = s.started_at;
    }
  }

  // Filtro de busca — normaliza underscores/hifens como espaços
  const q = search?.trim() ? normalize(search.trim()) : "";
  const filteredIds = q ? orderedIds.filter((id) => normalize(id).includes(q)) : orderedIds;

  const isSearching = q.length > 0;
  const total       = filteredIds.length;
  const totalPages  = isSearching ? 1 : Math.max(1, Math.ceil(total / TRACKS_PAGE_SIZE));
  const safePage    = isSearching ? 1 : Math.min(Math.max(1, page), totalPages);
  const pageIds     = isSearching ? filteredIds : filteredIds.slice((safePage - 1) * TRACKS_PAGE_SIZE, safePage * TRACKS_PAGE_SIZE);

  const pbsRes = pageIds.length > 0
    ? await supabase
        .from("personal_bests")
        .select("track_id, time_ms")
        .eq("user_id", user.id)
        .eq("car_id", carId)
        .in("track_id", pageIds)
    : { data: [] };

  const pbMap: Record<string, number> = {};
  for (const pb of pbsRes.data ?? []) pbMap[pb.track_id] = pb.time_ms;

  return {
    tracks: pageIds.map((tid) => ({
      track_id: tid,
      best_lap_ms: pbMap[tid] ?? null,
      sessions: countMap[tid] ?? 0,
      last_played_at: lastPlayedMap[tid] ?? null,
    })),
    total,
    totalPages,
    page: safePage,
  };
}

export async function getCarModalData(carId: string): Promise<CarModalData> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [specsRes, setupsRes] = await Promise.all([
    supabase.from("car_specs").select("*").eq("car_id", carId).maybeSingle(),
    supabase
      .from("car_setups")
      .select("*")
      .eq("user_id", user.id)
      .eq("car_id", carId)
      .order("updated_at", { ascending: false }),
  ]);

  return {
    specs: specsRes.data as CarSpecs | null,
    setups: (setupsRes.data ?? []) as CarSetup[],
  };
}

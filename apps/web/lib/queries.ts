import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import type {
  ProfileSummary,
  Session,
  PersonalBest,
  TopCar,
  TopTrack,
  AgentStatus,
  UserCarPreference,
  LapTelemetry,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Cached query functions
// All functions use 'use cache' for automatic caching with revalidation tags
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get profile summary (aggregated stats) for a user.
 * This is one of the most frequently accessed queries.
 */
export async function getProfileSummary(userId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:summary`);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("profile_summary")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return data as ProfileSummary | null;
}

/**
 * Get top cars for a user (sorted by session count).
 */
export async function getTopCars(userId: string, limit = 20) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:cars`);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("top_cars")
    .select("*")
    .eq("user_id", userId)
    .order("sessions", { ascending: false })
    .limit(limit);

  return (data ?? []) as TopCar[];
}

/**
 * Get top tracks for a user (sorted by session count).
 */
export async function getTopTracks(userId: string, limit = 20) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:tracks`);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("top_tracks")
    .select("*")
    .eq("user_id", userId)
    .order("sessions", { ascending: false })
    .limit(limit);

  return (data ?? []) as TopTrack[];
}

/**
 * Get user's personal bests (sorted by time).
 */
export async function getPersonalBests(userId: string, limit?: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:pbs`);

  const supabase = createServiceClient();
  let query = supabase
    .from("personal_bests")
    .select("*")
    .eq("user_id", userId)
    .order("time_ms", { ascending: true });

  if (limit) query = query.limit(limit);

  const { data } = await query;
  return (data ?? []) as PersonalBest[];
}

/**
 * Get agent status for a user.
 */
export async function getAgentStatus(userId: string) {
  "use cache";
  cacheLife("seconds");
  cacheTag(`user:${userId}`, `user:${userId}:agent`);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agent_status")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return data as AgentStatus | null;
}

/**
 * Get user car preferences (custom names).
 */
export async function getUserCarPreferences(userId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`user:${userId}`, `user:${userId}:prefs`);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("user_car_preferences")
    .select("*")
    .eq("user_id", userId);

  return (data ?? []) as UserCarPreference[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Session queries (shorter cache due to frequent updates)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all session dates for streak/calendar calculation.
 * Only fetches the started_at field for efficiency.
 */
export async function getAllSessionDates(userId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:sessions`);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("sessions")
    .select("started_at")
    .eq("user_id", userId);

  return (data ?? []) as { started_at: string }[];
}

/**
 * Get last session for a user.
 */
export async function getLastSession(userId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:sessions`);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as Session | null;
}

/**
 * Get sessions in a date range with specific fields for pace chart.
 */
export async function getSessionsForPaceChart(
  userId: string,
  sinceDate: Date
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:sessions`);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("sessions")
    .select("started_at, best_lap_ms, track_id")
    .eq("user_id", userId)
    .not("best_lap_ms", "is", null)
    .gte("started_at", sinceDate.toISOString())
    .order("started_at", { ascending: true });

  return (data ?? []) as {
    started_at: string;
    best_lap_ms: number;
    track_id: string;
  }[];
}

/**
 * Get sessions for activity calendar (last N days).
 */
export async function getSessionsForCalendar(userId: string, days: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:sessions`);

  const sinceDate = new Date(Date.now() - days * 86400000);
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("sessions")
    .select("started_at")
    .eq("user_id", userId)
    .gte("started_at", sinceDate.toISOString());

  return (data ?? []) as { started_at: string }[];
}

/**
 * Get sessions in a date range with lap count.
 */
export async function getSessionsWithLaps(
  userId: string,
  startDate: Date,
  endDate?: Date
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:sessions`);

  const supabase = createServiceClient();
  let query = supabase
    .from("sessions")
    .select("laps")
    .eq("user_id", userId)
    .gte("started_at", startDate.toISOString());

  if (endDate) {
    query = query.lt("started_at", endDate.toISOString());
  }

  const { data } = await query;
  return (data ?? []) as { laps: number }[];
}

/**
 * Get recent source IDs for lap queries.
 */
export async function getRecentSessionSourceIds(userId: string, limit = 10) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:sessions`);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("sessions")
    .select("source_id")
    .eq("user_id", userId)
    .not("best_lap_ms", "is", null)
    .order("started_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((s: { source_id: string }) => s.source_id);
}

/**
 * Get PBs created after a specific date.
 */
export async function getNewPersonalBests(userId: string, sinceDate: Date) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:pbs`);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("personal_bests")
    .select("id")
    .eq("user_id", userId)
    .gte("synced_at", sinceDate.toISOString());

  return (data ?? []) as { id: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Lap queries (for consistency calculations)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get lap times for consistency calculation.
 */
export async function getLapTimesForConsistency(
  userId: string,
  sessionSourceIds: string[],
  limit = 40
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:laps`);

  if (sessionSourceIds.length === 0) return [];

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("laps")
    .select("time_ms")
    .eq("user_id", userId)
    .in("session_source_id", sessionSourceIds)
    .eq("cuts", 0)
    .gt("time_ms", 0)
    .limit(limit);

  return (data ?? []) as { time_ms: number }[];
}

/**
 * Get lap times for a specific session.
 */
export async function getSessionLapTimes(
  userId: string,
  sessionSourceId: string
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:laps`);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("laps")
    .select("time_ms")
    .eq("user_id", userId)
    .eq("session_source_id", sessionSourceId)
    .eq("cuts", 0)
    .gt("time_ms", 0);

  return (data ?? []) as { time_ms: number }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Specific queries for session detail
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get personal best for a specific car+track combo.
 */
export async function getPersonalBestForCombo(
  userId: string,
  carId: string,
  trackId: string
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:pbs`);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("personal_bests")
    .select("*")
    .eq("user_id", userId)
    .eq("car_id", carId)
    .eq("track_id", trackId)
    .maybeSingle();

  return data as PersonalBest | null;
}

/**
 * Get previous best lap time for a car+track combo before a specific date.
 */
export async function getPreviousBestLap(
  userId: string,
  carId: string,
  trackId: string,
  beforeDate: string
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:sessions`);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("sessions")
    .select("best_lap_ms")
    .eq("user_id", userId)
    .eq("car_id", carId)
    .eq("track_id", trackId)
    .not("best_lap_ms", "is", null)
    .lt("started_at", beforeDate)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.best_lap_ms ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get sessions for analytics (last N weeks).
 */
export async function getSessionsForAnalytics(userId: string, weeks: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:sessions`);

  const sinceDate = new Date(Date.now() - weeks * 7 * 86400000);
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("sessions")
    .select("started_at, best_lap_ms, track_id, car_id, session_types, laps")
    .eq("user_id", userId)
    .gte("started_at", sinceDate.toISOString())
    .order("started_at", { ascending: true });

  return (data ?? []) as Session[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Garage page queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get recent sessions for a specific car.
 */
export async function getCarSessions(
  userId: string,
  carId: string,
  limit = 10
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:sessions`);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("car_id", carId)
    .order("started_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as Session[];
}

/**
 * Get personal bests for a specific car.
 */
export async function getCarPersonalBests(userId: string, carId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}`, `user:${userId}:pbs`);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("personal_bests")
    .select("*")
    .eq("user_id", userId)
    .eq("car_id", carId)
    .order("time_ms", { ascending: true });

  return (data ?? []) as PersonalBest[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get lap telemetry for a specific session.
 */
export async function getLapTelemetry(
  userId: string,
  sessionSourceId: string,
): Promise<LapTelemetry | null> {
  "use cache";
  cacheLife("seconds");
  cacheTag(`user:${userId}`, `user:${userId}:telemetry`);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("lap_telemetry")
    .select("*")
    .eq("user_id", userId)
    .eq("session_source_id", sessionSourceId)
    .order("synced_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data as LapTelemetry | null;
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SessionDetailContent, type SessionDetailData } from "./SessionDetailContent";
import type { Session, PersonalBest, Lap, Track, LapTelemetry } from "@/lib/types";
import { getLapTelemetry } from "@/lib/queries";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  const { sourceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [sessionRes, lapsRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("source_id", sourceId)
      .maybeSingle(),
    supabase
      .from("laps")
      .select("*")
      .eq("user_id", user.id)
      .eq("session_source_id", sourceId)
      .order("lap_number", { ascending: true }),
  ]);

  if (!sessionRes.data) redirect("/sessions");
  const session = sessionRes.data as Session;

  const [pbRes, trackSessionsRes, trackRes, telemetry] = await Promise.all([
    supabase
      .from("personal_bests")
      .select("*")
      .eq("user_id", user.id)
      .eq("car_id", session.car_id)
      .eq("track_id", session.track_id)
      .maybeSingle(),
    supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("track_id", session.track_id)
      .neq("source_id", sourceId)
      .order("started_at", { ascending: false })
      .limit(5),
    supabase
      .from("tracks")
      .select("*")
      .eq("track_id", session.track_id)
      .maybeSingle(),
    getLapTelemetry(user.id, sourceId),
  ]);

  const data: SessionDetailData = {
    session,
    laps: (lapsRes.data ?? []) as Lap[],
    pb: (pbRes.data ?? null) as PersonalBest | null,
    trackSessions: (trackSessionsRes.data ?? []) as Session[],
    track: (trackRes.data ?? null) as Track | null,
    telemetry: telemetry as LapTelemetry | null,
  };

  return <SessionDetailContent data={data} />;
}

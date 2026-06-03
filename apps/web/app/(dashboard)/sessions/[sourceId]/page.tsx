import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SessionDetailContent, type SessionDetailData } from "./SessionDetailContent";
import type { Session, PersonalBest, Lap, Track, LapTelemetry } from "@/lib/types";

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

  const [pbRes, trackSessionsRes, trackRes, telemetryRes] = await Promise.all([
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
    supabase
      .from("lap_telemetry")
      .select("*")
      .eq("user_id", user.id)
      .eq("session_source_id", sourceId)
      .order("synced_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  // TEMP (teste): se esta sessão não tem telemetria própria, cair para a
  // telemetria mais recente do usuário, só para validar o mapa visualmente.
  // Remover quando a captura do agente estiver confirmada em produção.
  let telemetry = (telemetryRes.data ?? null) as LapTelemetry | null;
  if (!telemetry) {
    const { data: fallback } = await supabase
      .from("lap_telemetry")
      .select("*")
      .eq("user_id", user.id)
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    telemetry = (fallback ?? null) as LapTelemetry | null;
  }

  const data: SessionDetailData = {
    session,
    laps: (lapsRes.data ?? []) as Lap[],
    pb: (pbRes.data ?? null) as PersonalBest | null,
    trackSessions: (trackSessionsRes.data ?? []) as Session[],
    track: (trackRes.data ?? null) as Track | null,
    telemetry,
  };

  return <SessionDetailContent data={data} />;
}

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Session, PersonalBest, Lap } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [sessionRes, lapsRes] = await Promise.all([
    supabase.from("sessions").select("*").eq("user_id", user.id).eq("source_id", id).maybeSingle(),
    supabase.from("laps").select("*").eq("user_id", user.id).eq("session_source_id", id).order("lap_number", { ascending: true }),
  ]);

  if (!sessionRes.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const s = sessionRes.data as Session;

  const [pbRes, trackSessionsRes] = await Promise.all([
    supabase.from("personal_bests").select("*").eq("user_id", user.id).eq("car_id", s.car_id).eq("track_id", s.track_id).maybeSingle(),
    supabase.from("sessions").select("*").eq("user_id", user.id).eq("track_id", s.track_id).neq("source_id", id).order("started_at", { ascending: false }).limit(5),
  ]);

  return NextResponse.json({
    session: s,
    laps: (lapsRes.data ?? []) as Lap[],
    pb: pbRes.data as PersonalBest | null,
    trackSessions: (trackSessionsRes.data ?? []) as Session[],
  });
}

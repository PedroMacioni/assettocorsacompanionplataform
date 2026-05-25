import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { is_active } = await req.json() as { is_active: boolean };

  const setupRes = await supabase
    .from("car_setups")
    .select("car_id, track_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!setupRes.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { car_id, track_id } = setupRes.data;

  if (is_active) {
    await supabase
      .from("car_setups")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("car_id", car_id)
      .eq("track_id", track_id);
  }

  const { error } = await supabase
    .from("car_setups")
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

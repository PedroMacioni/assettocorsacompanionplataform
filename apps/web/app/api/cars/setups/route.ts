import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { setups } = body as { setups: Record<string, unknown>[] };

  if (!Array.isArray(setups) || setups.length === 0) {
    return NextResponse.json({ error: "setups must be a non-empty array" }, { status: 400 });
  }

  const withUser = setups.map((s) => ({ ...s, user_id: user.id }));

  const { error, count } = await supabase
    .from("car_setups")
    .upsert(withUser, { onConflict: "user_id,car_id,track_id,name", count: "exact" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ upserted: count });
}

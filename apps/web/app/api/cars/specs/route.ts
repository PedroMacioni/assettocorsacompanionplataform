import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { specs } = body as { specs: Record<string, unknown>[] };

  if (!Array.isArray(specs) || specs.length === 0) {
    return NextResponse.json({ error: "specs must be a non-empty array" }, { status: 400 });
  }

  const { error, count } = await supabase
    .from("car_specs")
    .upsert(specs, { onConflict: "car_id", count: "exact" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ upserted: count });
}

import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type PairingRow = {
  id: string;
  public_code: string;
  device_name: string;
  status: "pending" | "approved" | "cancelled" | "expired";
  device_secret_hash: string;
  approved_device_id: string | null;
  expires_at: string;
  user_id: string | null;
};

function bearer(req: Request): string | null {
  const value = req.headers.get("authorization") ?? "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function hashSecret(secret: string): string {
  return `sha256:${createHash("sha256").update(secret).digest("hex")}`;
}

function secretMatches(rawSecret: string, storedHash: string): boolean {
  const actual = Buffer.from(hashSecret(rawSecret));
  const expected = Buffer.from(storedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const secret = bearer(req);
  if (!secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agent_pairing_requests")
    .select("id, public_code, device_name, status, device_secret_hash, approved_device_id, expires_at, user_id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pairing = data as PairingRow;
  if (!secretMatches(secret, pairing.device_secret_hash)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (pairing.status === "pending" && new Date(pairing.expires_at).getTime() <= Date.now()) {
    await admin
      .from("agent_pairing_requests")
      .update({ status: "expired" })
      .eq("id", pairing.id);

    return NextResponse.json({ status: "expired" });
  }

  return NextResponse.json({
    status: pairing.status,
    deviceId: pairing.approved_device_id,
    deviceName: pairing.device_name,
    userId: pairing.status === "approved" ? pairing.user_id : null,
    expiresAt: pairing.expires_at,
  });
}

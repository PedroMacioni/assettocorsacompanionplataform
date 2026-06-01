import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function hashSecret(s: string) {
  return `sha256:${createHash("sha256").update(s).digest("hex")}`;
}

function secretMatches(raw: string, stored: string) {
  const a = Buffer.from(hashSecret(raw));
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const deviceSecret = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!deviceSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let deviceId: string;
  try {
    ({ deviceId } = (await req.json()) as { deviceId: string });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!deviceId) return NextResponse.json({ error: "deviceId required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: device } = await admin
    .from("agent_devices")
    .select("id, user_id, device_secret_hash, status")
    .eq("id", deviceId)
    .eq("status", "connected")
    .maybeSingle();

  if (!device || !secretMatches(deviceSecret, device.device_secret_hash)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user email for magic link generation
  const { data: { user }, error: userErr } = await admin.auth.admin.getUserById(device.user_id);
  if (userErr || !user?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Generate a magic link (server-side only — does NOT send email)
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (linkErr || !linkData?.properties?.action_link) {
    console.error("[agent/auth] generateLink failed:", linkErr?.message, linkData);
    return NextResponse.json({ error: "Failed to generate link", detail: linkErr?.message }, { status: 500 });
  }

  // Follow the action_link without redirects — GoTrue returns the session
  // in the Location header fragment: #access_token=...&refresh_token=...
  const verifyRes = await fetch(linkData.properties.action_link, {
    method: "GET",
    redirect: "manual",
  });

  const location = verifyRes.headers.get("location") ?? "";
  const fragment = location.includes("#") ? location.slice(location.indexOf("#") + 1) : "";
  const params = new URLSearchParams(fragment);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) {
    console.error("[agent/auth] no tokens in redirect:", location);
    return NextResponse.json({ error: "Session exchange failed" }, { status: 500 });
  }

  const session = { access_token: accessToken, refresh_token: refreshToken };

  // Update heartbeat
  await admin
    .from("agent_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", deviceId);

  return NextResponse.json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user_id: device.user_id,
    email: user.email,
  });
}

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type PairingStartBody = {
  deviceName?: string;
  machineFingerprintHash?: string;
  deviceSecretHash?: string;
  appVersion?: string;
  platform?: string;
};

const HASH_RE = /^sha256:[a-f0-9]{64}$/i;

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function makePublicCode(): string {
  const raw = randomBytes(5).toString("hex").toUpperCase();
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export async function POST(req: Request) {
  let body: PairingStartBody;
  try {
    body = (await req.json()) as PairingStartBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const deviceName = cleanText(body.deviceName, 80);
  const machineFingerprintHash = cleanText(body.machineFingerprintHash, 80);
  const providedSecretHash = cleanText(body.deviceSecretHash, 80);
  const appVersion = cleanText(body.appVersion, 32) || null;
  const platform = cleanText(body.platform, 24) || "windows";

  if (!deviceName) {
    return NextResponse.json({ error: "deviceName is required" }, { status: 400 });
  }

  if (!HASH_RE.test(machineFingerprintHash)) {
    return NextResponse.json({ error: "machineFingerprintHash must be sha256 hex" }, { status: 400 });
  }

  if (!HASH_RE.test(providedSecretHash)) {
    return NextResponse.json({ error: "deviceSecretHash must be sha256 hex" }, { status: 400 });
  }

  const admin = createAdminClient();
  const publicCode = makePublicCode();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

  const { data, error } = await admin
    .from("agent_pairing_requests")
    .insert({
      public_code: publicCode,
      device_name: deviceName,
      machine_fingerprint_hash: machineFingerprintHash,
      device_secret_hash: providedSecretHash,
      app_version: appVersion,
      platform,
      expires_at: expiresAt,
    })
    .select("id, public_code, expires_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin = new URL(req.url).origin;

  return NextResponse.json({
    pairingId: data.id,
    connectUrl: `${origin}/agent/connect?code=${encodeURIComponent(data.public_code)}`,
    expiresAt: data.expires_at,
  });
}

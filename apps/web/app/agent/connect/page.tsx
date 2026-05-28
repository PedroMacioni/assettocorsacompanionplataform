import { randomUUID } from "crypto";
import { Check, Laptop, ShieldCheck, XCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ code?: string }>;

type PairingRequest = {
  id: string;
  public_code: string;
  device_name: string;
  machine_fingerprint_hash: string;
  device_secret_hash: string;
  platform: string;
  app_version: string | null;
  status: "pending" | "approved" | "cancelled" | "expired";
  expires_at: string;
};

async function getPairing(code: string): Promise<PairingRequest | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("agent_pairing_requests")
    .select("id, public_code, device_name, machine_fingerprint_hash, device_secret_hash, platform, app_version, status, expires_at")
    .eq("public_code", code)
    .maybeSingle();

  return (data as PairingRequest | null) ?? null;
}

function statusCopy(pairing: PairingRequest | null): { title: string; body: string } | null {
  if (!pairing) {
    return {
      title: "Connection request not found",
      body: "Open the agent and start a new connection request.",
    };
  }

  if (pairing.status === "approved") {
    return {
      title: "Computer already connected",
      body: "Return to the agent to continue setup.",
    };
  }

  if (pairing.status === "cancelled") {
    return {
      title: "Connection cancelled",
      body: "Open the agent to start a new request.",
    };
  }

  if (pairing.status === "expired" || new Date(pairing.expires_at).getTime() <= Date.now()) {
    return {
      title: "Connection request expired",
      body: "For security, connection requests expire after 10 minutes.",
    };
  }

  return null;
}

export default async function AgentConnectPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { code = "" } = await searchParams;
  const normalizedCode = code.trim().toUpperCase();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const pairing = normalizedCode ? await getPairing(normalizedCode) : null;
  const blocked = statusCopy(pairing);

  async function approvePairing() {
    "use server";

    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) redirect("/login");

    const current = await getPairing(normalizedCode);
    if (!current || current.status !== "pending" || new Date(current.expires_at).getTime() <= Date.now()) {
      redirect(`/agent/connect?code=${encodeURIComponent(normalizedCode)}`);
    }

    const admin = createAdminClient();
    const deviceId = randomUUID();

    const { error: deviceError } = await admin
      .from("agent_devices")
      .upsert(
        {
          user_id: user.id,
          id: deviceId,
          device_name: current.device_name,
          machine_fingerprint_hash: current.machine_fingerprint_hash,
          device_secret_hash: current.device_secret_hash,
          platform: current.platform,
          app_version: current.app_version,
          status: "connected",
          paired_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          revoked_at: null,
          revoked_by: null,
        },
        { onConflict: "user_id" }
      );

    if (deviceError) {
      throw new Error(deviceError.message);
    }

    const { error: pairingError } = await admin
      .from("agent_pairing_requests")
      .update({
        status: "approved",
        user_id: user.id,
        approved_device_id: deviceId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", current.id);

    if (pairingError) {
      throw new Error(pairingError.message);
    }

    redirect("/settings?section=agent");
  }

  async function cancelPairing() {
    "use server";

    const current = await getPairing(normalizedCode);
    if (current && current.status === "pending") {
      const admin = createAdminClient();
      await admin
        .from("agent_pairing_requests")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("id", current.id);
    }

    redirect("/settings");
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md bg-card border border-border rounded-md p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-md bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
            <Laptop className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Apex Agent
            </p>
            <h1 className="text-xl font-bold mt-1">
              {blocked ? blocked.title : "Connect this computer?"}
            </h1>
          </div>
        </div>

        {blocked ? (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground">{blocked.body}</p>
            <a
              href="/settings"
              className="mt-6 inline-flex items-center justify-center w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Back to settings
            </a>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-md border border-border bg-muted/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">Computer</span>
                <span className="text-sm font-semibold truncate">{pairing!.device_name}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">Version</span>
                <span className="text-sm font-semibold">{pairing!.app_version ?? "Unknown"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">Account</span>
                <span className="text-sm font-semibold truncate">{user.email}</span>
              </div>
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-md border border-border bg-background p-4">
              <ShieldCheck className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <p className="text-xs leading-5 text-muted-foreground">
                This will allow the agent on this computer to sync your Assetto Corsa sessions,
                laps, personal bests, tracks, cars, and setups. Connecting this computer replaces
                any other computer connected to this account.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <form action={cancelPairing}>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border bg-muted px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  Cancel
                </button>
              </form>
              <form action={approvePairing}>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Check className="h-4 w-4" />
                  Connect
                </button>
              </form>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

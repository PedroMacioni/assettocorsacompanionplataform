import { createClient } from "@/lib/supabase/server";
import type { ProfileSummary } from "@/lib/types";
import { SettingsClient, type ConnectedDevice } from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [summaryRes, deviceRes] = await Promise.all([
    supabase
      .from("profile_summary")
      .select("total_sessions, last_session_at")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase
      .from("agent_devices")
      .select("id, device_name, platform, app_version, paired_at, last_seen_at, last_synced_at, status")
      .eq("user_id", user!.id)
      .eq("status", "connected")
      .maybeSingle(),
  ]);

  const summary = summaryRes.data as Pick<ProfileSummary, "total_sessions" | "last_session_at"> | null;
  const connectedDevice = (deviceRes.data as ConnectedDevice | null) ?? null;

  return (
    <SettingsClient
      userId={user!.id}
      email={user!.email ?? ""}
      displayName={user!.user_metadata?.display_name ?? ""}
      avatarColor={user!.user_metadata?.avatar_color ?? "#e8612a"}
      avatarUrl={user!.user_metadata?.avatar_url ?? null}
      savedTheme={user!.user_metadata?.theme ?? null}
      savedLang={user!.user_metadata?.lang ?? null}
      memberSince={user!.created_at}
      totalSessions={summary?.total_sessions ?? 0}
      lastSessionAt={summary?.last_session_at ?? null}
      connectedDevice={connectedDevice}
    />
  );
}

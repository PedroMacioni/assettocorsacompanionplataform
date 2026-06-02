import { createClient } from "@/lib/supabase/server";
import type { ProfileSummary } from "@/lib/types";
import { SettingsClient, type ConnectedDevice } from "./SettingsClient";

const REPO = "PedroMacioni/ac-companion-agent";

async function fetchLatestRelease(): Promise<{
  version: string;
  downloadUrl: string;
  releaseUrl: string;
} | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      {
        next: { revalidate: 3600 },
        headers: { Accept: "application/vnd.github+json" },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const version = ((data.tag_name as string) ?? "").replace(/^v/, "");
    const asset = (
      data.assets as Array<{ name: string; browser_download_url: string }> | undefined
    )?.find((a) => a.name.endsWith(".exe"));
    return {
      version,
      downloadUrl: asset?.browser_download_url ?? (data.html_url as string),
      releaseUrl: data.html_url as string,
    };
  } catch {
    return null;
  }
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [summaryRes, deviceRes, latestRelease] = await Promise.all([
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
    fetchLatestRelease(),
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
      latestRelease={latestRelease}
    />
  );
}

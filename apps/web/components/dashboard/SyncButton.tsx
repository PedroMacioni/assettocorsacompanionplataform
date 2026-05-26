"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { revalidateUserData } from "@/lib/actions";

export function SyncButton({ userId }: { userId: string }) {
  const t = useTranslations("Header");
  const router = useRouter();
  const [state, setState] = useState<"idle" | "requested" | "syncing" | "success" | "error">("idle");

  const requestSync = useCallback(async () => {
    setState("requested");
    const supabase = createClient();

    // Record the request timestamp to detect new syncs
    const requestedAt = new Date().toISOString();
    const { error } = await supabase.from("agent_status").upsert(
      { user_id: userId, sync_requested_at: requestedAt },
      { onConflict: "user_id" }
    );

    if (error) {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
      return;
    }

    setState("syncing");

    // Poll for sync completion (agent updates last_synced_at when done)
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    const pollInterval = setInterval(async () => {
      attempts++;

      const { data } = await supabase
        .from("agent_status")
        .select("last_synced_at")
        .eq("user_id", userId)
        .maybeSingle();

      // Check if sync completed (last_synced_at is after our request)
      if (data?.last_synced_at && new Date(data.last_synced_at) > new Date(requestedAt)) {
        clearInterval(pollInterval);
        setState("success");

        // Invalidate cache and refresh the page
        await revalidateUserData(userId);
        router.refresh();

        setTimeout(() => setState("idle"), 2000);
        return;
      }

      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        // Even on timeout, invalidate cache in case sync happened
        await revalidateUserData(userId);
        router.refresh();
        setState("idle");
      }
    }, 1000);
  }, [userId, router]);

  const isLoading = state === "requested" || state === "syncing";

  return (
    <button
      onClick={requestSync}
      disabled={isLoading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-muted hover:bg-muted/80 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <>
          <svg className="animate-spin" width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 20" strokeLinecap="round" />
          </svg>
          {t("syncing")}
        </>
      ) : state === "success" ? (
        <>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M2.5 5.5l2.5 2.5 4-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-green-500" />
          </svg>
          <span className="text-green-500">{t("synced")}</span>
        </>
      ) : state === "error" ? (
        <>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5" className="stroke-destructive" />
            <path d="M5.5 3.5v2.5M5.5 7.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="stroke-destructive" />
          </svg>
          <span className="text-destructive">{t("error")}</span>
        </>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path
              d="M9.5 5.5A4 4 0 111.5 5.5M9.5 2v3.5H6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t("syncNow")}
        </>
      )}
    </button>
  );
}

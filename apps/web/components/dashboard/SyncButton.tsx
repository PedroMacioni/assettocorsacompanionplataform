"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SyncButton({ userId }: { userId: string }) {
  const [state, setState] = useState<"idle" | "requested" | "error">("idle");

  async function requestSync() {
    setState("requested");
    const supabase = createClient();
    const { error } = await supabase.from("agent_status").upsert(
      { user_id: userId, sync_requested_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (error) {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    } else {
      setTimeout(() => setState("idle"), 5000);
    }
  }

  return (
    <button
      onClick={requestSync}
      disabled={state === "requested"}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#2a2a2c] bg-[#1e1e20] hover:bg-[#262628] text-[11px] font-medium text-[#6b6b72] hover:text-[#f0f0f0] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {state === "requested" ? (
        <>
          <svg
            className="animate-spin"
            width="11"
            height="11"
            viewBox="0 0 11 11"
            fill="none"
          >
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 20" strokeLinecap="round" />
          </svg>
          Solicitado...
        </>
      ) : state === "error" ? (
        <>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="#ef4444" strokeWidth="1.5" />
            <path d="M5.5 3.5v2.5M5.5 7.5v.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-[#ef4444]">Erro</span>
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
          Sincronizar agora
        </>
      )}
    </button>
  );
}

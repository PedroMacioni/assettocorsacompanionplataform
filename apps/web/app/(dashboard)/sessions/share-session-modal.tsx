"use client";

import { useRef, useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ShareModal } from "@/components/ui/share-modal";
import { SessionShareCard, type ShareCardTheme } from "./session-share-card";
import type { SessionWithMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

type BestLapSplit = {
  lap_number: number | null;
  time_ms: number | null;
  s1_ms: number | null;
  s2_ms: number | null;
  s3_ms: number | null;
  tyre: string | null;
};

type Props = {
  session: SessionWithMeta | null;
  open: boolean;
  theme: ShareCardTheme;
  onThemeChange: (theme: ShareCardTheme) => void;
  onClose: () => void;
};

export function ShareSessionModal({ session, open, theme, onThemeChange, onClose }: Props) {
  const t = useTranslations("Sessions.share");
  const locale = useLocale();
  const cardRef = useRef<HTMLDivElement>(null);
  const [bestLapResult, setBestLapResult] = useState<{
    sourceId: string;
    bestLapMs: number;
    split: BestLapSplit | null;
  } | null>(null);

  useEffect(() => {
    if (!open || !session?.source_id || session.best_lap_ms === null) {
      return;
    }

    let cancelled = false;
    const sourceId = session.source_id;
    const bestLapMs = session.best_lap_ms;

    async function fetchBestLap() {
      const supabase = createClient();
      const { data } = await supabase
        .from("laps")
        .select("lap_number, time_ms, s1_ms, s2_ms, s3_ms, tyre")
        .eq("session_source_id", sourceId)
        .eq("time_ms", bestLapMs)
        .order("cuts", { ascending: true })
        .order("lap_number", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        setBestLapResult({
          sourceId,
          bestLapMs,
          split: data ? (data as BestLapSplit) : null,
        });
      }
    }

    fetchBestLap();

    return () => {
      cancelled = true;
    };
  }, [open, session?.source_id, session?.best_lap_ms]);

  if (!session) return null;

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/session/${session.source_id}`;
  const bestLap =
    bestLapResult?.sourceId === session.source_id &&
    bestLapResult.bestLapMs === session.best_lap_ms
      ? bestLapResult.split
      : null;
  const themeOptions: { value: ShareCardTheme; label: string; icon: typeof Moon }[] = [
    { value: "dark", label: t("theme.dark"), icon: Moon },
    { value: "light", label: t("theme.light"), icon: Sun },
  ];

  return (
    <ShareModal
      open={open}
      onClose={onClose}
      title={t("title")}
      shareUrl={shareUrl}
      copyLinkLabel={t("copyLink")}
      saveImageLabel={t("saveImage")}
      linkCopiedLabel={t("linkCopied")}
      imageSavedLabel={t("imageSaved")}
      imageBackgroundColor={theme === "dark" ? "#0a0a0a" : "#f4f4f5"}
      cardRef={cardRef}
    >
      <div className="flex w-full flex-col items-center gap-3">
        <div className="inline-flex rounded-lg border border-border bg-control p-1">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => onThemeChange(value)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                theme === value
                  ? "bg-surface-raised text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-control-hover hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        <SessionShareCard
          ref={cardRef}
          theme={theme}
          locale={locale}
          carId={session.car_id}
          trackId={session.track_id}
          bestLapMs={session.best_lap_ms}
          deltaPbMs={session.deltaPbMs}
          date={session.started_at}
          badge={session.badge}
          sessionType={session.session_types}
          lapsCount={session.laps}
          bestLap={bestLap}
          labels={{
            newPb: t("card.newPb"),
            bestLapSectors: t("card.bestLapSectors"),
            lap: t("card.lap"),
            tyre: t("card.tyre"),
            lapsText: t("card.laps", { count: session.laps ?? 0 }),
          }}
        />
      </div>
    </ShareModal>
  );
}

"use client";

import { useRef, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { ShareModal } from "@/components/ui/share-modal";
import { SessionShareCard } from "./session-share-card";
import type { SessionWithMeta } from "@/lib/types";

type Sectors = {
  s1_ms: number | null;
  s2_ms: number | null;
  s3_ms: number | null;
};

type Props = {
  session: SessionWithMeta | null;
  open: boolean;
  onClose: () => void;
};

export function ShareSessionModal({ session, open, onClose }: Props) {
  const t = useTranslations("Sessions.share");
  const cardRef = useRef<HTMLDivElement>(null);
  const [sectors, setSectors] = useState<Sectors | null>(null);

  useEffect(() => {
    if (!open || !session) {
      setSectors(null);
      return;
    }

    async function fetchSectors() {
      if (!session?.source_id || session.best_lap_ms === null) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("laps")
        .select("s1_ms, s2_ms, s3_ms")
        .eq("session_source_id", session.source_id)
        .eq("time_ms", session.best_lap_ms)
        .limit(1)
        .maybeSingle();
      if (data) setSectors(data);
    }

    fetchSectors();
  }, [open, session]);

  if (!session) return null;

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/session/${session.source_id}`;

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
      cardRef={cardRef}
    >
      <SessionShareCard
        ref={cardRef}
        carId={session.car_id}
        trackId={session.track_id}
        bestLapMs={session.best_lap_ms}
        deltaPbMs={session.deltaPbMs}
        date={session.started_at}
        badge={session.badge}
        sessionType={session.session_types}
        lapsCount={session.laps}
        sectors={sectors}
      />
    </ShareModal>
  );
}

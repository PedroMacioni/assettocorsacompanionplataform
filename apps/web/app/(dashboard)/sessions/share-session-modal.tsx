"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { ShareModal } from "@/components/ui/share-modal";
import { SessionShareCard } from "./session-share-card";
import type { SessionWithMeta } from "@/lib/types";

type Props = {
  session: SessionWithMeta | null;
  open: boolean;
  onClose: () => void;
};

export function ShareSessionModal({ session, open, onClose }: Props) {
  const t = useTranslations("Sessions.share");
  const cardRef = useRef<HTMLDivElement>(null);

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
      />
    </ShareModal>
  );
}

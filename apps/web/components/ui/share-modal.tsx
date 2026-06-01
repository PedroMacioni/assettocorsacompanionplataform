"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { X, Link2, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type ShareModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  shareUrl: string;
  copyLinkLabel: string;
  saveImageLabel: string;
  linkCopiedLabel: string;
  imageSavedLabel: string;
  cardRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
};

export function ShareModal({
  open,
  onClose,
  title,
  shareUrl,
  copyLinkLabel,
  saveImageLabel,
  linkCopiedLabel,
  imageSavedLabel,
  cardRef,
  children,
}: ShareModalProps) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [imageSaved, setImageSaved] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
      };
    }
  }, [open, onClose]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  }, [shareUrl]);

  const handleSaveImage = useCallback(async () => {
    if (!cardRef.current) return;

    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: "#0a0a0a",
      });

      const link = document.createElement("a");
      link.download = "session-card.png";
      link.href = dataUrl;
      link.click();

      setImageSaved(true);
      setTimeout(() => setImageSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save image:", error);
    }
  }, [cardRef]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 id="share-modal-title" className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="p-4">
            <div className="mb-4 flex justify-center">{children}</div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleCopyLink}
              >
                {linkCopied ? (
                  <>
                    <Check className="size-4" data-icon="inline-start" />
                    {linkCopiedLabel}
                  </>
                ) : (
                  <>
                    <Link2 className="size-4" data-icon="inline-start" />
                    {copyLinkLabel}
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleSaveImage}
              >
                {imageSaved ? (
                  <>
                    <Check className="size-4" data-icon="inline-start" />
                    {imageSavedLabel}
                  </>
                ) : (
                  <>
                    <Download className="size-4" data-icon="inline-start" />
                    {saveImageLabel}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

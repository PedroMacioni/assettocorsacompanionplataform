"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { updateCarDisplayName } from "./actions";

interface Props {
  carId: string;
  currentDisplayName: string | null;
  originalName: string;
  variant?: "dark" | "default";
}

export function EditCarNameButton({ carId, currentDisplayName, originalName, variant = "dark" }: Props) {
  const t = useTranslations("Garage.edit");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentDisplayName ?? "");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(currentDisplayName ?? "");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, currentDisplayName]);

  function handleSave() {
    startTransition(async () => {
      await updateCarDisplayName(carId, value);
      setOpen(false);
      router.refresh();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          variant === "dark"
            ? "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors backdrop-blur-sm"
            : "flex items-center gap-1 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        }
      >
        <Pencil className="w-3 h-3" />
        {t("button")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-foreground mb-0.5">{t("title")}</h3>
            <p className="text-xs text-muted-foreground mb-4">{originalName}</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("displayNameLabel")}
                </label>
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("placeholder")}
                  className="mt-1.5 w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">{t("hint")}</p>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 px-3 py-2 rounded-md text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex-1 px-3 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isPending ? "…" : t("save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

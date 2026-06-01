"use client";

import { Trophy, BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SessionBadge as SessionBadgeType } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  badge: SessionBadgeType;
  className?: string;
};

export function SessionBadge({ badge, className }: Props) {
  const t = useTranslations("Sessions.badges");

  if (!badge) return null;

  const config = {
    new_pb: {
      label: t("newPb"),
      icon: Trophy,
      className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    },
    consistent: {
      label: t("consistent"),
      icon: BarChart3,
      className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    },
  };

  const { label, icon: Icon, className: badgeClassName } = config[badge];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        badgeClassName,
        className
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}

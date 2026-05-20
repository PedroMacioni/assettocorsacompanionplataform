import type { SessionQualityBadge as BadgeType } from "@/lib/calculations";

interface SessionQualityBadgeProps {
  badge: BadgeType;
  size?: "sm" | "md";
}

export function SessionQualityBadge({ badge, size = "md" }: SessionQualityBadgeProps) {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-3 py-1 text-xs",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wider ${sizeClasses[size]}`}
      style={{
        backgroundColor: badge.bgColor,
        color: badge.color,
      }}
    >
      <span>{badge.icon}</span>
      <span>{badge.label}</span>
    </span>
  );
}

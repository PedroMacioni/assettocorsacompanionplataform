"use client";

import { cn } from "@/lib/utils";

interface ProfileDropdownProps {
  displayName: string;
  email: string;
  avatarUrl: string | null;
  collapsed?: boolean;
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className="w-8 h-8 rounded-full object-cover shrink-0 border border-border"
      />
    );
  }
  const parts = name.trim().split(/\s+/);
  const letters =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-primary/[0.12] border border-primary/25 flex items-center justify-center shrink-0">
      <span className="text-[11px] font-bold text-primary">{letters}</span>
    </div>
  );
}

export function ProfileDropdown({ displayName, email, avatarUrl, collapsed }: ProfileDropdownProps) {
  if (collapsed) {
    return (
      <div className="p-1.5 flex justify-center rounded-md bg-surface-raised border border-sidebar-border">
        <Avatar name={displayName || "D"} avatarUrl={avatarUrl} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full mx-1 p-2.5 rounded-md bg-surface-raised border border-sidebar-border",
        "flex items-center gap-2.5"
      )}
    >
      <Avatar name={displayName || "D"} avatarUrl={avatarUrl} />
      <div className="flex-1 min-w-0 text-left">
        <p className="text-xs font-semibold text-foreground truncate leading-tight">
          {displayName}
        </p>
        <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
          {email}
        </p>
      </div>
    </div>
  );
}

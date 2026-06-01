"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Settings, LogOut, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

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
  const t = useTranslations("Sidebar");
  const { signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  async function handleSignOut() {
    setIsOpen(false);
    await signOut();
  }

  if (collapsed) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 flex justify-center rounded-md bg-muted border border-border hover:bg-muted/70 transition-colors cursor-pointer"
        >
          <Avatar name={displayName || "D"} avatarUrl={avatarUrl} />
        </button>

        {isOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-48 bg-popover border border-border rounded-lg shadow-lg py-1 z-50">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{email}</p>
            </div>
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="h-4 w-4" />
              {t("settings")}
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {t("signOut")}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full mx-1 p-2.5 rounded-md bg-muted border border-border",
          "hover:bg-muted/70 transition-colors cursor-pointer",
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
        <MoreVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-1 right-1 mb-2 bg-popover border border-border rounded-lg shadow-lg py-1 z-50">
          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Settings className="h-4 w-4" />
            {t("settings")}
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {t("signOut")}
          </button>
        </div>
      )}
    </div>
  );
}

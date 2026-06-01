"use client";

import { useState, useCallback, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SessionsClient } from "./SessionsClient";
import { SessionsFilters, type SessionFilterOption } from "./SessionsFilters";
import { ShareSessionModal } from "./share-session-modal";
import { PageLoader } from "@/components/PageLoader";
import { PaginationClient } from "@/components/ui/pagination-client";
import type { SessionWithMeta } from "@/lib/types";
import type { ShareCardTheme } from "./session-share-card";

type SortDirection = "asc" | "desc" | null;

function getCurrentShareTheme(): ShareCardTheme {
  if (typeof window === "undefined") return "dark";

  const savedTheme = window.localStorage.getItem("apex-theme");
  if (savedTheme === "dark" || savedTheme === "light") return savedTheme;

  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

type SelectedFilters = {
  car?: string;
  track?: string;
  period?: string;
  onlyPb?: boolean;
};

interface Props {
  sessions: SessionWithMeta[];
  cars: SessionFilterOption[];
  tracks: SessionFilterOption[];
  selected: SelectedFilters;
  activeFilterCount: number;
  currentPage: number;
  totalPages: number;
  queryParams: Record<string, string | undefined>;
}

export function SessionsContent({
  sessions,
  cars,
  tracks,
  selected,
  activeFilterCount,
  currentPage,
  totalPages,
  queryParams,
}: Props) {
  const t = useTranslations("Sessions");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [shareSession, setShareSession] = useState<SessionWithMeta | null>(null);
  const [shareTheme, setShareTheme] = useState<ShareCardTheme>("dark");

  const sortedSessions = useMemo(() => {
    if (sortDirection === null) return sessions;

    return [...sessions].sort((a, b) => {
      const aTime = a.best_lap_ms ?? Infinity;
      const bTime = b.best_lap_ms ?? Infinity;
      return sortDirection === "asc" ? aTime - bTime : bTime - aTime;
    });
  }, [sessions, sortDirection]);

  const openSession = useCallback((sourceId: string) => {
    router.push(`/sessions/${sourceId}`);
  }, [router]);

  const openShare = useCallback((session: SessionWithMeta) => {
    setShareTheme(getCurrentShareTheme());
    setShareSession(session);
  }, []);

  function handlePageChange(page: number) {
    if (page === currentPage || isPending) return;

    const next = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) next.set(key, value);
    });
    next.set("page", String(page));

    startTransition(() => {
      router.push(`/sessions?${next.toString()}`);
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {t("title")}
      </h1>

      <SessionsFilters
        cars={cars}
        tracks={tracks}
        selected={selected}
        activeCount={activeFilterCount}
      />

      {isPending ? (
        <div className="rounded-lg border border-border bg-card">
          <PageLoader size="md" className="min-h-[320px]" />
        </div>
      ) : (
        <SessionsClient
          sessions={sortedSessions}
          sortDirection={sortDirection}
          onSelect={openSession}
          onShare={openShare}
          onSortChange={setSortDirection}
        />
      )}

      <PaginationClient
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />

      <ShareSessionModal
        session={shareSession}
        open={shareSession !== null}
        theme={shareTheme}
        onThemeChange={setShareTheme}
        onClose={() => setShareSession(null)}
      />
    </div>
  );
}

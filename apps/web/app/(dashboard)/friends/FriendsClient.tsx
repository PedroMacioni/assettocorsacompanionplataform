"use client";

import type { FormEvent } from "react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Search, Send, Trash2, UserPlus, X, ChevronDown, ChevronUp, Flag, MoreVertical, LogOut, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/PageLoader";
import { formatLapTime } from "@/lib/format";
import { FilterBar, FilterControl } from "@/components/FilterBar";
import {
  acceptFriendRequest, declineFriendRequest, removeFriend,
  searchUsers, sendFriendRequest,
  type FriendSearchResult, type FriendshipDirection, type FriendshipStatus, type SocialProfile,
} from "./actions";

export type FriendListItem = {
  friendshipId: string;
  status: FriendshipStatus;
  direction: FriendshipDirection;
  createdAt: string;
  profile: SocialProfile;
  summary?: { total_sessions: number; total_laps: number; fastest_lap_ms: number | null };
};

type Props = {
  title: string;
  eyebrow: string;
  description: string;
  initialFriends: FriendListItem[];
  initialIncoming: FriendListItem[];
  initialOutgoing: FriendListItem[];
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function profileName(p: SocialProfile) {
  return p.display_name || p.username || "Driver";
}

function friendSince(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function DriverAvatar({ profile, size = 44 }: { profile: SocialProfile; size?: number }) {
  const name = profileName(profile);
  const color = profile.avatar_color ?? "#e8612a";
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "DR";

  if (profile.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profile.avatar_url} alt={name}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size, border: `2px solid ${color}50` }}
      />
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center shrink-0 font-bold select-none"
      style={{ width: size, height: size, backgroundColor: `${color}18`, border: `2px solid ${color}40`, color, fontSize: Math.round(size * 0.34) }}>
      {initials}
    </div>
  );
}

// ─── Remove confirmation modal ────────────────────────────────────────────────

function RemoveConfirmModal({ name, onConfirm, onCancel, busy }: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const t = useTranslations("Friends");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl shadow-black/50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        <div className="h-1 w-full bg-destructive/70" />

        <div className="px-7 py-8 flex flex-col items-center text-center gap-5">
          <div className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <LogOut className="w-6 h-6 text-destructive" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-foreground">{t("removeConfirm.title")}</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {t.rich("removeConfirm.description", {
                name,
                b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
              })}
            </p>
          </div>

          <div className="flex gap-3 w-full pt-1">
            <button
              onClick={onCancel}
              className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {t("removeConfirm.cancel")}
            </button>
            <button
              onClick={onConfirm}
              disabled={busy}
              className="flex-1 h-10 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {t("removeConfirm.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Driver card (accepted) ───────────────────────────────────────────────────

function DriverCard({ item, busyId, onRemove }: {
  item: FriendListItem;
  busyId: string | null;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations("Friends");
  const { profile, summary } = item;
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const color = profile.avatar_color ?? "#e8612a";
  const profileHref = profile.username ? `/profile/${profile.username}` : null;
  const name = profileName(profile);
  const busy = busyId === item.friendshipId;

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  return (
    <div className="relative bg-card border border-border rounded-xl overflow-hidden transition-all duration-200 hover:border-primary/20 hover:shadow-xl hover:shadow-black/10 flex flex-col">
      {/* color band */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}30)` }} />

      <div className="p-4 flex flex-col gap-4 flex-1">

        {/* header row */}
        <div className="flex items-start gap-3">
          <DriverAvatar profile={profile} size={52} />

          <div className="flex-1 min-w-0 pt-0.5">
            <p className="font-bold text-foreground text-[13px] leading-snug truncate">{name}</p>
            {profile.username && (
              <p className="text-[11px] text-muted-foreground/70 leading-none mt-0.5">@{profile.username}</p>
            )}
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {profile.country && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  <Flag className="w-2.5 h-2.5 shrink-0" />{profile.country}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground/40">{t("card.since", { date: friendSince(item.createdAt) })}</span>
            </div>
          </div>

          {/* 3-dot menu */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              disabled={busy}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-30 w-48 bg-popover border border-border rounded-lg shadow-lg shadow-black/20 animate-in fade-in zoom-in-95 duration-100 overflow-hidden py-1">
                <button
                  onClick={() => { setMenuOpen(false); setConfirmOpen(true); }}
                  disabled={busy}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  {t("card.removeMenu")}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* stats */}
        {summary ? (
          <div className="grid grid-cols-3 divide-x divide-border border border-border rounded-lg overflow-hidden">
            {[
              { value: summary.total_sessions.toLocaleString("pt-BR"), label: t("card.sessions") },
              { value: summary.total_laps.toLocaleString("pt-BR"), label: t("card.laps") },
              { value: summary.fastest_lap_ms ? formatLapTime(summary.fastest_lap_ms) : "—", label: t("card.best") },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center py-2.5 px-1 bg-muted/30">
                <p className="text-xs font-bold text-foreground font-mono leading-none">{value}</p>
                <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider mt-1">{label}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-[52px] rounded-lg bg-muted/30 border border-border animate-pulse" />
        )}

        {/* ver perfil */}
        {profileHref ? (
          <Link
            href={profileHref}
            className="mt-auto flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border text-xs font-semibold text-foreground/70 hover:text-foreground hover:border-primary/40 hover:bg-muted/40 transition-all"
          >
            {t("actions.viewProfile")}
          </Link>
        ) : (
          <div className="mt-auto h-8" />
        )}
      </div>

      {confirmOpen && (
        <RemoveConfirmModal
          name={name}
          busy={busy}
          onConfirm={() => { setConfirmOpen(false); onRemove(item.friendshipId); }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Incoming request card ────────────────────────────────────────────────────

function RequestCard({ item, busyId, onAccept, onDecline }: {
  item: FriendListItem;
  busyId: string | null;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const t = useTranslations("Friends");
  const busy = busyId === item.friendshipId;
  return (
    <div className="flex items-center gap-3 bg-card border border-primary/20 rounded-xl px-4 py-3 shadow-sm">
      <DriverAvatar profile={item.profile} size={40} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">{profileName(item.profile)}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {item.profile.username ? `@${item.profile.username}` : ""}
          {item.profile.country ? (item.profile.username ? ` · ${item.profile.country}` : item.profile.country) : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => onAccept(item.friendshipId)} disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1">
          <Check className="w-3 h-3" /> {t("actions.accept")}
        </button>
        <button onClick={() => onDecline(item.friendshipId)} disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors disabled:opacity-50">
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Add Friend Modal ─────────────────────────────────────────────────────────

function AddFriendModal({ onClose, busyId, onAction, onAccept, onDecline }: {
  onClose: () => void;
  busyId: string | null;
  onAction: (id: string, action: () => Promise<void>) => void;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const t = useTranslations("Friends");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FriendSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function runSearch(q = query) {
    const trimmed = q.trim();
    setError("");
    setHasSearched(true);
    if (trimmed.length < 2) { setResults([]); return; }
    setSearching(true);
    try { setResults(await searchUsers(trimmed)); }
    catch { setError(t("modal.error")); setResults([]); }
    finally { setSearching(false); }
  }

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await runSearch();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* panel */}
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 animate-in fade-in zoom-in-95 duration-200 flex flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-foreground">{t("modal.title")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t("modal.subtitle")}</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* search input */}
        <div className="px-4 py-3 border-b border-border">
          <form onSubmit={onSearch}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); if (e.target.value.trim().length >= 2) runSearch(e.target.value); }}
                placeholder={t("modal.placeholder")}
                className="w-full h-9 rounded-lg border border-input bg-background pl-9 pr-9 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
              )}
            </div>
          </form>
        </div>

        {/* results */}
        <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
          {searching ? (
            <PageLoader size="sm" className="min-h-[140px]" />
          ) : error ? (
            <p className="px-5 py-4 text-sm text-destructive">{error}</p>
          ) : hasSearched && query.trim().length < 2 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">{t("modal.minChars")}</p>
          ) : hasSearched && results.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t("modal.noResults")}</p>
            </div>
          ) : results.length > 0 ? (
            <div className="p-2">
              {results.map((r) => (
                <SearchRow
                  key={r.id}
                  result={r}
                  busyId={busyId}
                  onAction={onAction}
                  onAccept={onAccept}
                  onDecline={onDecline}
                />
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center">
              <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{t("modal.hint")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchRow({ result, busyId, onAction, onAccept, onDecline }: {
  result: FriendSearchResult;
  busyId: string | null;
  onAction: (id: string, action: () => Promise<void>) => void;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const t = useTranslations("Friends");
  const isFriend = result.friendshipStatus === "accepted";
  const isPendingOut = result.friendshipStatus === "pending" && result.friendshipDirection === "outgoing";
  const isPendingIn = result.friendshipStatus === "pending" && result.friendshipDirection === "incoming";

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors">
      <DriverAvatar profile={result} size={36} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{profileName(result)}</p>
        <p className="text-[11px] text-muted-foreground">
          {result.username ? `@${result.username}` : ""}
          {result.country ? (result.username ? ` · ${result.country}` : result.country) : ""}
        </p>
      </div>
      <div className="shrink-0">
        {isFriend ? (
          <span className="flex items-center gap-1 text-xs text-primary font-semibold px-2.5 py-1 rounded-lg bg-primary/10">
            <Check className="w-3 h-3" /> {t("actions.friend")}
          </span>
        ) : isPendingOut ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium px-2.5 py-1 rounded-lg bg-muted">
            <Send className="w-3 h-3" /> {t("actions.sent")}
          </span>
        ) : isPendingIn && result.friendshipId ? (
          <div className="flex gap-1.5">
            <button disabled={busyId === result.friendshipId} onClick={() => onAccept(result.friendshipId!)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {t("actions.accept")}
            </button>
            <button disabled={busyId === result.friendshipId} onClick={() => onDecline(result.friendshipId!)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50">
              {t("actions.decline")}
            </button>
          </div>
        ) : (
          <button disabled={busyId === result.id} onClick={() => onAction(result.id, () => sendFriendRequest(result.id))}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors">
            <UserPlus className="w-3 h-3" /> {t("actions.add")}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyFriends({ onAdd }: { onAdd: () => void }) {
  const t = useTranslations("Friends");
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <UserPlus className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="text-base font-semibold text-foreground mb-1">{t("noDriversTitle")}</p>
      <p className="text-sm text-muted-foreground max-w-xs mb-5">{t("noDriversDesc")}</p>
      <button onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
        <UserPlus className="w-4 h-4" /> {t("addDriver")}
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type SortKey = "name" | "sessions" | "best";

const inputClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30";

export function FriendsClient({ title, eyebrow, description, initialFriends, initialIncoming, initialOutgoing }: Props) {
  const t = useTranslations("Friends");
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [outgoingOpen, setOutgoingOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");

  async function runAction(id: string, action: () => Promise<void>) {
    setBusyId(id);
    try {
      await action();
      router.refresh();
    } catch {
      // silent
    } finally {
      setBusyId(null);
    }
  }

  function handleAccept(id: string) { runAction(id, () => acceptFriendRequest(id)); }
  function handleDecline(id: string) { runAction(id, () => declineFriendRequest(id)); }
  function handleRemove(id: string) { runAction(id, () => removeFriend(id)); }

  const friendCount = initialFriends.length;
  const hasFilters = !!search || sortKey !== "name";

  const visibleFriends = initialFriends
    .filter((item) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const name = profileName(item.profile).toLowerCase();
      const username = (item.profile.username ?? "").toLowerCase();
      return name.includes(q) || username.includes(q);
    })
    .sort((a, b) => {
      if (sortKey === "sessions") return (b.summary?.total_sessions ?? 0) - (a.summary?.total_sessions ?? 0);
      if (sortKey === "best") {
        const bms = b.summary?.fastest_lap_ms ?? Infinity;
        const ams = a.summary?.fastest_lap_ms ?? Infinity;
        return ams - bms;
      }
      return profileName(a.profile).localeCompare(profileName(b.profile));
    });

  return (
    <div className="space-y-8">

      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{eyebrow}</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {friendCount > 0 ? t("connected", { count: friendCount }) : description}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-card border border-border text-sm font-semibold text-foreground hover:border-primary/40 hover:bg-muted/40 transition-all shrink-0 mt-1"
        >
          <UserPlus className="w-4 h-4 text-primary" />
          <span className="hidden sm:inline">{t("addDriver")}</span>
        </button>
      </div>

      {/* incoming requests */}
      {initialIncoming.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {initialIncoming.length}
            </span>
            <h2 className="text-sm font-semibold text-foreground">
              {t("incomingTitle", { count: initialIncoming.length })}
            </h2>
          </div>
          {initialIncoming.map((item) => (
            <RequestCard key={item.friendshipId} item={item} busyId={busyId} onAccept={handleAccept} onDecline={handleDecline} />
          ))}
        </section>
      )}

      {/* filters — só aparecem quando há amigos */}
      {friendCount > 0 && (
        <FilterBar
          title={t("filters.title")}
          activeLabel={hasFilters ? t("filters.active", { count: [search, sortKey !== "name" ? sortKey : ""].filter(Boolean).length }) : undefined}
          clearLabel={t("filters.clear")}
          canClear={hasFilters}
          onClear={() => { setSearch(""); setSortKey("name"); }}
        >
          <FilterControl label={t("filters.search")} icon={<Search className="size-3" />}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("filters.searchPlaceholder")}
              className={inputClassName}
            />
          </FilterControl>

          <FilterControl label={t("filters.sort")} icon={<ArrowUpDown className="size-3" />}>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className={inputClassName}
            >
              <option value="name">{t("filters.sortName")}</option>
              <option value="sessions">{t("filters.sortSessions")}</option>
              <option value="best">{t("filters.sortBest")}</option>
            </select>
          </FilterControl>
        </FilterBar>
      )}

      {/* friends grid */}
      <section>
        {friendCount > 0 && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            {visibleFriends.length < friendCount
              ? t("filters.showing", { shown: visibleFriends.length, total: friendCount })
              : t("yourDrivers")}
          </p>
        )}
        {friendCount === 0 ? (
          <EmptyFriends onAdd={() => setModalOpen(true)} />
        ) : visibleFriends.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="w-8 h-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">{t("filters.noResults")}</p>
            <p className="text-xs text-muted-foreground">{t("filters.noResultsHint")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleFriends.map((item) => (
              <DriverCard key={item.friendshipId} item={item} busyId={busyId} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </section>

      {/* outgoing */}
      {initialOutgoing.length > 0 && (
        <section>
          <button
            onClick={() => setOutgoingOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {outgoingOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {t("outgoingTitle", { count: initialOutgoing.length })}
          </button>
          {outgoingOpen && (
            <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
              {initialOutgoing.map((item) => (
                <div key={item.friendshipId} className="flex items-center gap-3 px-4 py-2.5 bg-card border border-border rounded-xl">
                  <DriverAvatar profile={item.profile} size={34} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{profileName(item.profile)}</p>
                    <p className="text-[11px] text-muted-foreground">{t("waitingResponse")}</p>
                  </div>
                  <button
                    onClick={() => handleRemove(item.friendshipId)}
                    disabled={busyId === item.friendshipId}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                  >
                    {t("actions.cancelRequest")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* modal */}
      {modalOpen && (
        <AddFriendModal
          onClose={() => setModalOpen(false)}
          busyId={busyId}
          onAction={runAction}
          onAccept={handleAccept}
          onDecline={handleDecline}
        />
      )}
    </div>
  );
}

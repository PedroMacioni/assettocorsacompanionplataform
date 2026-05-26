"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { setFavoriteCar, setFavoriteTrack } from "./actions";
import { formatLapTime, slugToName } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Star,
  Car,
  MapPin,
  X,
  Search,
  Check,
  Loader2,
  Pencil,
  ArrowRight,
} from "lucide-react";

// ─── types ────────────────────────────────────────────────────────────────────

export type FavoriteCarInfo = {
  carId: string;
  displayName: string;
  brand: string | null;
  carClass: string | null;
  sessions: number;
  totalLaps: number;
  bestLapMs: number | null;
} | null;

export type FavoriteTrackInfo = {
  trackId: string;
  name: string;
  country: string | null;
  sessions: number;
  totalLaps: number;
  bestLapMs: number | null;
} | null;

type CarOption = {
  car_id: string;
  name: string;
  brand: string | null;
  carClass: string | null;
  sessions: number;
  best_lap_ms: number | null;
};

type TrackOption = {
  track_id: string;
  name: string;
  country: string | null;
  sessions: number;
  best_lap_ms: number | null;
};

// ─── picker modal ─────────────────────────────────────────────────────────────

function PickerModal<T>({
  open,
  onClose,
  title,
  items,
  loading,
  currentId,
  saving,
  getKey,
  renderItem,
  onSelect,
  searchPlaceholder,
  filterFn,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  items: T[];
  loading: boolean;
  currentId: string | null;
  saving: string | null;
  getKey: (item: T) => string;
  renderItem: (item: T, isCurrent: boolean, isSaving: boolean) => React.ReactNode;
  onSelect: (item: T) => void;
  searchPlaceholder: string;
  filterFn: (item: T, query: string) => boolean;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = query.trim()
    ? items.filter((item) => filterFn(item, query.toLowerCase()))
    : items;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md flex flex-col bg-card border border-border rounded-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-muted border border-border rounded-md pl-9 pr-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 py-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Nenhum resultado
            </p>
          ) : (
            filtered.map((item) => {
              const key = getKey(item);
              const isCurrent = key === currentId;
              const isSaving = saving === key;
              return (
                <button
                  key={key}
                  onClick={() => onSelect(item)}
                  disabled={saving !== null}
                  className={cn(
                    "relative w-full text-left px-5 py-3.5 flex items-center gap-3 transition-colors",
                    isCurrent
                      ? "bg-primary/5 hover:bg-primary/8"
                      : "hover:bg-muted/50",
                    saving !== null && !isSaving && "opacity-50"
                  )}
                >
                  {isCurrent && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full" />
                  )}
                  <div className="flex-1 min-w-0">
                    {renderItem(item, isCurrent, isSaving)}
                  </div>
                  <div className="shrink-0 w-5 flex items-center justify-center">
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    ) : isCurrent ? (
                      <Check className="w-4 h-4 text-primary" />
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function ProfileFavoritesSection({
  userId,
  initialFavCar,
  initialFavTrack,
}: {
  userId: string;
  initialFavCar: FavoriteCarInfo;
  initialFavTrack: FavoriteTrackInfo;
}) {
  const t = useTranslations("Profile");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [favCar, setFavCar] = useState<FavoriteCarInfo>(initialFavCar);
  const [favTrack, setFavTrack] = useState<FavoriteTrackInfo>(initialFavTrack);

  const [carModalOpen, setCarModalOpen] = useState(false);
  const [trackModalOpen, setTrackModalOpen] = useState(false);

  const [carOptions, setCarOptions] = useState<CarOption[]>([]);
  const [trackOptions, setTrackOptions] = useState<TrackOption[]>([]);
  const [carsLoading, setCarsLoading] = useState(false);
  const [tracksLoading, setTracksLoading] = useState(false);

  const [savingCarId, setSavingCarId] = useState<string | null>(null);
  const [savingTrackId, setSavingTrackId] = useState<string | null>(null);

  // ── fetch car options ──────────────────────────────────────────────────────

  async function openCarModal() {
    setCarModalOpen(true);
    if (carOptions.length > 0) return;
    setCarsLoading(true);
    try {
      const supabase = createClient();
      const { data: topCars } = await supabase
        .from("top_cars")
        .select("car_id, sessions, total_laps, best_lap_ms")
        .eq("user_id", userId)
        .order("sessions", { ascending: false });

      if (!topCars?.length) return;

      const carIds = topCars.map((c) => c.car_id);
      const [{ data: specs }, { data: prefs }] = await Promise.all([
        supabase.from("car_specs").select("car_id, name, brand, class").in("car_id", carIds),
        supabase
          .from("user_car_preferences")
          .select("car_id, display_name")
          .eq("user_id", userId)
          .in("car_id", carIds),
      ]);

      const specMap = new Map((specs ?? []).map((s) => [s.car_id, s]));
      const prefMap = new Map((prefs ?? []).map((p) => [p.car_id, p.display_name]));

      setCarOptions(
        topCars.map((c) => {
          const spec = specMap.get(c.car_id);
          return {
            car_id: c.car_id,
            name: prefMap.get(c.car_id) ?? spec?.name ?? slugToName(c.car_id),
            brand: spec?.brand ?? null,
            carClass: spec?.class ?? null,
            sessions: c.sessions,
            best_lap_ms: c.best_lap_ms,
          };
        })
      );
    } finally {
      setCarsLoading(false);
    }
  }

  // ── fetch track options ────────────────────────────────────────────────────

  async function openTrackModal() {
    setTrackModalOpen(true);
    if (trackOptions.length > 0) return;
    setTracksLoading(true);
    try {
      const supabase = createClient();
      const { data: topTracks } = await supabase
        .from("top_tracks")
        .select("track_id, sessions, total_laps, best_lap_ms")
        .eq("user_id", userId)
        .order("sessions", { ascending: false });

      if (!topTracks?.length) return;

      const trackIds = topTracks.map((t) => t.track_id);
      const { data: trackData } = await supabase
        .from("tracks")
        .select("track_id, name, country")
        .in("track_id", trackIds);

      const trackMap = new Map((trackData ?? []).map((t) => [t.track_id, t]));

      setTrackOptions(
        topTracks.map((t) => {
          const info = trackMap.get(t.track_id);
          return {
            track_id: t.track_id,
            name: info?.name ?? slugToName(t.track_id),
            country: info?.country ?? null,
            sessions: t.sessions,
            best_lap_ms: t.best_lap_ms,
          };
        })
      );
    } finally {
      setTracksLoading(false);
    }
  }

  // ── save car ───────────────────────────────────────────────────────────────

  async function handleSelectCar(option: CarOption) {
    if (savingCarId) return;
    setSavingCarId(option.car_id);
    try {
      await setFavoriteCar(option.car_id);
      setFavCar({
        carId: option.car_id,
        displayName: option.name,
        brand: option.brand,
        carClass: option.carClass,
        sessions: option.sessions,
        totalLaps: 0,
        bestLapMs: option.best_lap_ms,
      });
      setCarModalOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setSavingCarId(null);
    }
  }

  // ── save track ─────────────────────────────────────────────────────────────

  async function handleSelectTrack(option: TrackOption) {
    if (savingTrackId) return;
    setSavingTrackId(option.track_id);
    try {
      await setFavoriteTrack(option.track_id);
      setFavTrack({
        trackId: option.track_id,
        name: option.name,
        country: option.country,
        sessions: option.sessions,
        totalLaps: 0,
        bestLapMs: option.best_lap_ms,
      });
      setTrackModalOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setSavingTrackId(null);
    }
  }

  // ── render cards ───────────────────────────────────────────────────────────

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* ── Car card ────────────────────────────────────────────────────── */}
        {favCar ? (
          <div className="bg-card border border-border rounded-md p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("favoriteCar")}
                </p>
              </div>
              <button
                onClick={openCarModal}
                className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="w-3 h-3" />
                {t("changeButton")}
              </button>
            </div>

            <p className="text-base font-bold text-foreground leading-tight">
              {favCar.displayName}
            </p>
            {(favCar.brand || favCar.carClass) && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {[favCar.brand, favCar.carClass].filter(Boolean).join(" · ")}
              </p>
            )}

            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
              {[
                { label: t("sessions"), value: favCar.sessions.toLocaleString() },
                { label: t("laps"), value: favCar.totalLaps > 0 ? favCar.totalLaps.toLocaleString() : "—" },
                { label: t("bestLap"), value: formatLapTime(favCar.bestLapMs) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {label}
                  </p>
                  <p className="text-sm font-bold text-foreground font-mono mt-0.5">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <button onClick={openCarModal} className="group text-left">
            <div className="bg-card border border-border rounded-md p-5 h-full flex flex-col items-center justify-center gap-3 text-center group-hover:border-primary/40 transition-colors min-h-[160px]">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Car className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("noFavoriteCar")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("noFavoriteCarHint")}</p>
              </div>
              <span className="flex items-center gap-1 text-xs text-primary font-medium">
                {t("chooseFavorite")} <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </button>
        )}

        {/* ── Track card ──────────────────────────────────────────────────── */}
        {favTrack ? (
          <div className="bg-card border border-border rounded-md p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("favoriteTrack")}
                </p>
              </div>
              <button
                onClick={openTrackModal}
                className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="w-3 h-3" />
                {t("changeButton")}
              </button>
            </div>

            <p className="text-base font-bold text-foreground leading-tight">
              {favTrack.name}
            </p>
            {favTrack.country && (
              <p className="text-xs text-muted-foreground mt-0.5">{favTrack.country}</p>
            )}

            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
              {[
                { label: t("sessions"), value: favTrack.sessions.toLocaleString() },
                { label: t("laps"), value: favTrack.totalLaps > 0 ? favTrack.totalLaps.toLocaleString() : "—" },
                { label: t("bestLap"), value: formatLapTime(favTrack.bestLapMs) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {label}
                  </p>
                  <p className="text-sm font-bold text-foreground font-mono mt-0.5">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <button onClick={openTrackModal} className="group text-left">
            <div className="bg-card border border-border rounded-md p-5 h-full flex flex-col items-center justify-center gap-3 text-center group-hover:border-primary/40 transition-colors min-h-[160px]">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <MapPin className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("noFavoriteTrack")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("noFavoriteTrackHint2")}</p>
              </div>
              <span className="flex items-center gap-1 text-xs text-primary font-medium">
                {t("chooseFavorite")} <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </button>
        )}
      </div>

      {/* ── Car picker modal ─────────────────────────────────────────────── */}
      <PickerModal
        open={carModalOpen}
        onClose={() => setCarModalOpen(false)}
        title={t("carPickerTitle")}
        items={carOptions}
        loading={carsLoading}
        currentId={favCar?.carId ?? null}
        saving={savingCarId}
        getKey={(c) => c.car_id}
        searchPlaceholder={t("pickerSearch")}
        filterFn={(c, q) =>
          c.name.toLowerCase().includes(q) ||
          (c.brand?.toLowerCase().includes(q) ?? false)
        }
        onSelect={handleSelectCar}
        renderItem={(c, isCurrent) => (
          <>
            <p
              className={cn(
                "text-sm font-semibold leading-tight",
                isCurrent ? "text-foreground" : "text-foreground"
              )}
            >
              {c.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {[c.brand, c.carClass].filter(Boolean).join(" · ")}
              {" · "}
              {t("pickerSessions", { count: c.sessions })}
            </p>
          </>
        )}
      />

      {/* ── Track picker modal ───────────────────────────────────────────── */}
      <PickerModal
        open={trackModalOpen}
        onClose={() => setTrackModalOpen(false)}
        title={t("trackPickerTitle")}
        items={trackOptions}
        loading={tracksLoading}
        currentId={favTrack?.trackId ?? null}
        saving={savingTrackId}
        getKey={(tr) => tr.track_id}
        searchPlaceholder={t("pickerSearch")}
        filterFn={(tr, q) =>
          tr.name.toLowerCase().includes(q) ||
          (tr.country?.toLowerCase().includes(q) ?? false)
        }
        onSelect={handleSelectTrack}
        renderItem={(tr, isCurrent) => (
          <>
            <p className="text-sm font-semibold text-foreground leading-tight">{tr.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {[tr.country].filter(Boolean).join("")}
              {tr.country ? " · " : ""}
              {t("pickerSessions", { count: tr.sessions })}
            </p>
          </>
        )}
      />
    </>
  );
}

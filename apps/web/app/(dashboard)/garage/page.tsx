import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/EmptyState";
import type { TopCar, CarSpecs, UserCarPreference } from "@/lib/types";
import { GarageContent } from "./GarageContent";
import { Suspense } from "react";
import { redirect } from "next/navigation";

type SearchParams = {
  search?: string;
  class?: string;
  brand?: string;
  favorites?: string;
  recent?: string;
  page?: string;
};

const PAGE_SIZE = 10;

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function GaragePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const t = await getTranslations("Garage");
  const params = await searchParams;
  const currentPage = parsePage(params.page);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const uid = user.id;
  const thirtyDaysAgo = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [carsRes, prefsRes, specsRes, recentRes] = await Promise.all([
    supabase.from("top_cars").select("*").eq("user_id", uid).order("sessions", { ascending: false }),
    supabase.from("user_car_preferences").select("*").eq("user_id", uid),
    supabase.from("car_specs").select("*"),
    params.recent === "1"
      ? supabase
          .from("sessions")
          .select("car_id")
          .eq("user_id", uid)
          .gte("started_at", thirtyDaysAgo)
      : Promise.resolve({ data: [] }),
  ]);

  const allCars = (carsRes.data ?? []) as TopCar[];
  const prefs = (prefsRes.data ?? []) as UserCarPreference[];
  const allSpecs = (specsRes.data ?? []) as CarSpecs[];

  const prefMap: Record<string, UserCarPreference> = Object.fromEntries(
    prefs.map((p) => [p.car_id, p])
  );
  const specsMap: Record<string, CarSpecs> = Object.fromEntries(
    allSpecs.map((s) => [s.car_id, s])
  );

  if (allCars.length === 0) {
    return <EmptyState title={t("empty.title")} description={t("empty.description")} />;
  }

  const recentCarIds = new Set(
    (recentRes.data ?? []).map((s: { car_id: string }) => s.car_id)
  );

  let filtered = allCars;

  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter((c) => {
      const pref = prefMap[c.car_id];
      const name = (pref?.display_name ?? specsMap[c.car_id]?.name ?? c.car_id).toLowerCase();
      return name.includes(q) || c.car_id.includes(q);
    });
  }

  if (params.class) {
    filtered = filtered.filter((c) => specsMap[c.car_id]?.class === params.class);
  }

  if (params.brand) {
    filtered = filtered.filter((c) => specsMap[c.car_id]?.brand === params.brand);
  }

  if (params.favorites === "1") {
    filtered = filtered.filter((c) => prefMap[c.car_id]?.is_favorite === true);
  }

  if (params.recent === "1") {
    filtered = filtered.filter((c) => recentCarIds.has(c.car_id));
  }

  filtered = filtered.sort((a, b) => {
    const aFav = prefMap[a.car_id]?.is_favorite ? 1 : 0;
    const bFav = prefMap[b.car_id]?.is_favorite ? 1 : 0;
    return bFav - aFav;
  });

  const availableClasses = Array.from(
    new Set(allCars.map((c) => specsMap[c.car_id]?.class).filter(Boolean) as string[])
  ).sort();

  const availableBrands = Array.from(
    new Set(allCars.map((c) => specsMap[c.car_id]?.brand).filter(Boolean) as string[])
  ).sort();

  const totalSessions = allCars.reduce((sum, c) => sum + c.sessions, 0);
  const totalDistance = allCars.reduce((sum, c) => sum + (c.total_distance_km ?? 0), 0);
  const filteredCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <Suspense>
      <GarageContent
        cars={paginated}
        specsMap={specsMap}
        prefMap={prefMap}
        availableClasses={availableClasses}
        availableBrands={availableBrands}
        totalCars={allCars.length}
        totalSessions={totalSessions}
        totalDistance={totalDistance}
        currentPage={safePage}
        totalPages={totalPages}
        queryParams={{
          search: params.search,
          class: params.class,
          brand: params.brand,
          favorites: params.favorites,
          recent: params.recent,
        }}
      />
    </Suspense>
  );
}

export function formatLapTime(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "—";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export function formatDistance(km: number | null | undefined): string {
  if (!km) return "—";
  return `${km.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function slugToName(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDelta(deltaMs: number | null | undefined): string {
  if (deltaMs === null || deltaMs === undefined) return "—";
  const sign = deltaMs <= 0 ? "" : "+";
  const seconds = Math.abs(deltaMs) / 1000;
  return `${sign}${seconds.toFixed(3)}s`;
}

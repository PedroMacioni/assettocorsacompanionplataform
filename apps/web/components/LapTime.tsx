import { formatLapTime } from "@/lib/format";

export function LapTime({ ms }: { ms: number | null | undefined }) {
  return <span>{formatLapTime(ms)}</span>;
}

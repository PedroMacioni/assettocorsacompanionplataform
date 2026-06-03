import type { TelemetryPoint } from "@/lib/types";

export type CanvasPoint = {
  cx: number;
  cy: number;
  speed: number;
  throttle: number;
  brake: number;
};

export function normalizePoints(
  points: TelemetryPoint[],
  width: number,
  height: number,
  padding = 0.06
): CanvasPoint[] {
  const xs = points.map(p => p[0] / 10);
  const zs = points.map(p => p[1] / 10);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const rangeX = maxX - minX || 1;
  const rangeZ = maxZ - minZ || 1;
  const range = Math.max(rangeX, rangeZ);
  const offX = (range - rangeX) / 2;
  const offZ = (range - rangeZ) / 2;
  const inner = 1 - 2 * padding;

  return points.map(p => ({
    cx: ((p[0] / 10 - minX + offX) / range * inner + padding) * width,
    cy: ((p[1] / 10 - minZ + offZ) / range * inner + padding) * height,
    speed: p[2],
    throttle: p[3],
    brake: p[4],
  }));
}

export function speedToColor(speed: number, maxSpeed: number): string {
  const r = Math.min(speed / (maxSpeed * 0.92), 1);
  const hue = Math.round(240 - r * 240);
  return `hsl(${hue},90%,${48 + r * 8}%)`;
}

export function throttleToColor(throttle: number): string {
  const g = Math.round(80 + throttle * 175);
  return `rgb(0,${g},0)`;
}

export function brakeToColor(brake: number): string {
  const r = Math.round(80 + brake * 175);
  return `rgb(${r},0,0)`;
}

export function findByNormPos(totalPoints: number, normPos: number): number {
  return Math.min(Math.round(normPos * totalPoints), totalPoints - 1);
}

export function findClosestCanvasPoint(
  pts: CanvasPoint[],
  mx: number,
  my: number,
  threshold = 20
): number | null {
  let best = -1, bestDist = threshold * threshold;
  for (let i = 0; i < pts.length; i++) {
    const dx = pts[i].cx - mx, dy = pts[i].cy - my;
    const d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best === -1 ? null : best;
}

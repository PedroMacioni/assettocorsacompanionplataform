import type { TelemetryPoint } from "@/lib/types";

export type CanvasPoint = {
  cx: number;
  cy: number;
  speed: number;
  throttle: number;
  brake: number;
};

// Auto-detect the 2 axes (of x/y/z) with the largest range for the 2D map
function pickAxes(points: TelemetryPoint[]): [0 | 1 | 2, 0 | 1 | 2] {
  const ranges = [0, 1, 2].map(i => {
    const vals = points.map(p => p[i] as number);
    return Math.max(...vals) - Math.min(...vals);
  });
  const sorted = [0, 1, 2].sort((a, b) => ranges[b] - ranges[a]);
  return [sorted[0] as 0 | 1 | 2, sorted[1] as 0 | 1 | 2];
}

export function normalizePoints(
  points: TelemetryPoint[],
  width: number,
  height: number,
  padding = 0.06
): CanvasPoint[] {
  if (points.length === 0) return [];
  const [ai, bi] = pickAxes(points);
  const as_ = points.map(p => p[ai] / 10);
  const bs  = points.map(p => p[bi] / 10);
  const minA = Math.min(...as_), maxA = Math.max(...as_);
  const minB = Math.min(...bs),  maxB = Math.max(...bs);
  const rangeA = maxA - minA || 1;
  const rangeB = maxB - minB || 1;
  const range  = Math.max(rangeA, rangeB);
  const offA   = (range - rangeA) / 2;
  const offB   = (range - rangeB) / 2;
  const inner  = 1 - 2 * padding;

  return points.map(p => ({
    cx: ((p[ai] / 10 - minA + offA) / range * inner + padding) * width,
    cy: ((p[bi] / 10 - minB + offB) / range * inner + padding) * height,
    speed:    p[3],
    throttle: p[4],
    brake:    p[5],
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

// ─── Derived Stats ─────────────────────────────────────────────────────────────

/**
 * Extrai o valor de clutch do ponto de telemetria.
 * Retrocompat: pontos com 6 elementos (sem clutch) retornam 0.
 */
export function clutchOf(point: TelemetryPoint): number {
  // Cast to unknown[] to access potential 7th element (future clutch data)
  const arr = point as unknown as number[];
  return arr.length > 6 ? arr[6] : 0;
}

/**
 * Calcula a distância acumulada ao longo da volta.
 * Retorna array normalizado de 0 a 1 (para usar como eixo X do trace).
 */
export function cumulativeDistance(points: TelemetryPoint[]): number[] {
  if (points.length === 0) return [];

  const distances: number[] = [0];
  let total = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    // Coordenadas estão em ×10, dividir para metros reais
    const dx = (curr[0] - prev[0]) / 10;
    const dy = (curr[1] - prev[1]) / 10; // AC Y is longitudinal
    const dz = (curr[2] - prev[2]) / 10;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    total += dist;
    distances.push(total);
  }

  // Normalizar para 0-1
  if (total === 0) return distances.map(() => 0);
  return distances.map(d => d / total);
}

/**
 * Calcula estatísticas derivadas da volta.
 */
export function computeLapStats(points: TelemetryPoint[], maxSpeed: number) {
  if (points.length === 0) {
    return {
      maxSpeed: 0,
      minSpeed: 0,
      avgSpeed: 0,
      pctFullThrottle: 0,
      maxSpeedIdx: 0,
      minSpeedIdx: 0,
    };
  }

  let minSpeed = Infinity;
  let maxSpeedFound = 0;
  let minSpeedIdx = 0;
  let maxSpeedIdx = 0;
  let speedSum = 0;
  let fullThrottleCount = 0;

  for (let i = 0; i < points.length; i++) {
    const speed = points[i][3];
    const throttle = points[i][4];

    speedSum += speed;

    if (speed > maxSpeedFound) {
      maxSpeedFound = speed;
      maxSpeedIdx = i;
    }
    if (speed < minSpeed) {
      minSpeed = speed;
      minSpeedIdx = i;
    }

    // Full throttle = 95%+ (margem para ruído de input)
    if (throttle >= 95) {
      fullThrottleCount++;
    }
  }

  return {
    maxSpeed: maxSpeedFound,
    minSpeed: minSpeed === Infinity ? 0 : minSpeed,
    avgSpeed: Math.round(speedSum / points.length),
    pctFullThrottle: Math.round((fullThrottleCount / points.length) * 100),
    maxSpeedIdx,
    minSpeedIdx,
  };
}

/**
 * Detecta zonas de frenagem: índices onde o freio cruza de baixo para cima de um threshold.
 * Retorna os índices dos pontos onde a frenagem inicia.
 */
export function detectBrakingZones(points: TelemetryPoint[], threshold = 20): number[] {
  const zones: number[] = [];

  for (let i = 1; i < points.length; i++) {
    const prevBrake = points[i - 1][5];
    const currBrake = points[i][5];

    // Crossing from below threshold to above
    if (prevBrake < threshold && currBrake >= threshold) {
      zones.push(i);
    }
  }

  return zones;
}

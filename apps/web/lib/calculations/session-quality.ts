export type SessionQualityType = 'pb' | 'improving' | 'consistent' | 'warmup';

export interface SessionQualityBadge {
  type: SessionQualityType;
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}

const BADGE_CONFIG: Record<SessionQualityType, Omit<SessionQualityBadge, 'type'>> = {
  pb: {
    label: 'PB SESSION',
    color: '#fbbf24',
    bgColor: '#fbbf2420',
    icon: '🏆',
  },
  improving: {
    label: 'IMPROVING',
    color: '#22c55e',
    bgColor: '#22c55e20',
    icon: '📈',
  },
  consistent: {
    label: 'CONSISTENT',
    color: '#3b82f6',
    bgColor: '#3b82f620',
    icon: '🎯',
  },
  warmup: {
    label: 'WARM-UP',
    color: '#6b6b72',
    bgColor: '#6b6b7220',
    icon: '🔄',
  },
};

interface SessionData {
  best_lap_ms: number | null;
  laps: number;
  lap_times?: number[]; // Optional array of individual lap times
}

interface QualityContext {
  previousBestMs?: number | null;
  previousSessionAvgMs?: number | null;
  currentSessionAvgMs?: number | null;
  currentSessionStdDev?: number | null;
}

/**
 * Determine the quality badge for a session.
 * Priority: PB > Improving > Consistent > Warm-up
 */
export function getSessionQualityBadge(
  session: SessionData,
  context: QualityContext
): SessionQualityBadge {
  const { previousBestMs, previousSessionAvgMs, currentSessionAvgMs, currentSessionStdDev } = context;

  // Check for PB
  if (
    session.best_lap_ms &&
    previousBestMs &&
    session.best_lap_ms < previousBestMs
  ) {
    return { type: 'pb', ...BADGE_CONFIG.pb };
  }

  // Check for improving (average time better than previous session)
  if (
    currentSessionAvgMs &&
    previousSessionAvgMs &&
    currentSessionAvgMs < previousSessionAvgMs
  ) {
    return { type: 'improving', ...BADGE_CONFIG.improving };
  }

  // Check for consistent (low standard deviation, at least 5 laps)
  if (
    session.laps >= 5 &&
    currentSessionStdDev !== null &&
    currentSessionStdDev !== undefined &&
    currentSessionStdDev < 1000 // Less than 1 second std dev
  ) {
    return { type: 'consistent', ...BADGE_CONFIG.consistent };
  }

  // Default to warm-up
  return { type: 'warmup', ...BADGE_CONFIG.warmup };
}

/**
 * Calculate average lap time from an array of lap times.
 */
export function calculateAvgLapTime(lapTimesMs: number[]): number | null {
  const validTimes = lapTimesMs.filter(t => t > 0);
  if (validTimes.length === 0) return null;
  return validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
}

/**
 * Calculate standard deviation of lap times.
 */
export function calculateStdDev(lapTimesMs: number[]): number | null {
  const validTimes = lapTimesMs.filter(t => t > 0);
  if (validTimes.length < 2) return null;

  const mean = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
  const variance = validTimes.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / validTimes.length;
  return Math.sqrt(variance);
}

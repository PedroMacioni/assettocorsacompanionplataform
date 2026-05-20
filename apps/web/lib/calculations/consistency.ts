/**
 * Calculate a consistency score (0-100) based on the standard deviation
 * of lap times. Lower deviation = higher score.
 */
export function calculateConsistencyScore(lapTimesMs: number[]): {
  score: number;
  trend: 'up' | 'down' | 'stable';
  stdDevMs: number;
} {
  if (lapTimesMs.length < 2) {
    return { score: 0, trend: 'stable', stdDevMs: 0 };
  }

  // Filter out invalid times
  const validTimes = lapTimesMs.filter(t => t > 0);
  if (validTimes.length < 2) {
    return { score: 0, trend: 'stable', stdDevMs: 0 };
  }

  // Calculate mean
  const mean = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;

  // Calculate variance and standard deviation
  const variance = validTimes.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / validTimes.length;
  const stdDev = Math.sqrt(variance);

  // Normalize to 0-100
  // stdDev of 0ms = 100 (perfect consistency)
  // stdDev of 5000ms (5 seconds) = 0 (very inconsistent)
  // Linear scale between these values
  const maxStdDev = 5000;
  const score = Math.max(0, Math.min(100, Math.round(100 - (stdDev / maxStdDev) * 100)));

  // Calculate trend by comparing first half vs second half std dev
  const mid = Math.floor(validTimes.length / 2);
  const firstHalf = validTimes.slice(0, mid);
  const secondHalf = validTimes.slice(mid);

  let trend: 'up' | 'down' | 'stable' = 'stable';

  if (firstHalf.length >= 2 && secondHalf.length >= 2) {
    const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const firstVar = firstHalf.reduce((sum, t) => sum + Math.pow(t - firstMean, 2), 0) / firstHalf.length;
    const secondVar = secondHalf.reduce((sum, t) => sum + Math.pow(t - secondMean, 2), 0) / secondHalf.length;

    const firstStd = Math.sqrt(firstVar);
    const secondStd = Math.sqrt(secondVar);

    // If second half has significantly lower std dev, trending up
    const threshold = 200; // 200ms difference threshold
    if (secondStd < firstStd - threshold) {
      trend = 'up';
    } else if (secondStd > firstStd + threshold) {
      trend = 'down';
    }
  }

  return { score, trend, stdDevMs: Math.round(stdDev) };
}

/**
 * Get color and label for consistency score.
 */
export function getConsistencyLevel(score: number): {
  color: string;
  bgColor: string;
  label: string;
} {
  if (score >= 80) {
    return { color: '#22c55e', bgColor: '#22c55e20', label: 'Consistente' };
  }
  if (score >= 60) {
    return { color: '#fbbf24', bgColor: '#fbbf2420', label: 'Moderado' };
  }
  return { color: '#ef4444', bgColor: '#ef444420', label: 'Inconsistente' };
}

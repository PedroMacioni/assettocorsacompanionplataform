import { describe, it, expect } from 'vitest';
import {
  getSessionQualityBadge,
  calculateAvgLapTime,
  calculateStdDev,
} from '../calculations/session-quality';

describe('calculateAvgLapTime', () => {
  it('returns null for empty array', () => {
    expect(calculateAvgLapTime([])).toBeNull();
  });

  it('returns null when all times are invalid (zero or negative)', () => {
    expect(calculateAvgLapTime([0, -1000, 0])).toBeNull();
  });

  it('calculates average correctly', () => {
    const laps = [90000, 92000, 88000];
    expect(calculateAvgLapTime(laps)).toBe(90000);
  });

  it('filters out invalid times before calculating', () => {
    const laps = [90000, 0, 92000, -5000, 88000];
    // Only valid: 90000, 92000, 88000 -> avg = 90000
    expect(calculateAvgLapTime(laps)).toBe(90000);
  });

  it('returns the single value for one valid lap', () => {
    expect(calculateAvgLapTime([85000])).toBe(85000);
  });
});

describe('calculateStdDev', () => {
  it('returns null for empty array', () => {
    expect(calculateStdDev([])).toBeNull();
  });

  it('returns null for single lap (needs at least 2)', () => {
    expect(calculateStdDev([90000])).toBeNull();
  });

  it('returns null when fewer than 2 valid times after filtering', () => {
    expect(calculateStdDev([90000, 0, -1000])).toBeNull();
  });

  it('returns 0 for identical lap times', () => {
    const laps = [90000, 90000, 90000];
    expect(calculateStdDev(laps)).toBe(0);
  });

  it('calculates standard deviation correctly', () => {
    // Mean = 90000, deviations: -2000, 0, 2000
    // Variance = (4000000 + 0 + 4000000) / 3 = 2666666.67
    // StdDev = sqrt(2666666.67) ≈ 1632.99
    const laps = [88000, 90000, 92000];
    const stdDev = calculateStdDev(laps);
    expect(stdDev).toBeCloseTo(1632.99, 0);
  });

  it('filters out invalid times before calculating', () => {
    const laps = [90000, 0, 90000, -1000];
    // Only valid: 90000, 90000 -> stdDev = 0
    expect(calculateStdDev(laps)).toBe(0);
  });
});

describe('getSessionQualityBadge', () => {
  it('returns PB badge when best lap beats previous best', () => {
    const session = { best_lap_ms: 85000, laps: 10 };
    const context = {
      previousBestMs: 86000,
      previousSessionAvgMs: 90000,
      currentSessionAvgMs: 88000,
    };
    const badge = getSessionQualityBadge(session, context);
    expect(badge.type).toBe('pb');
    expect(badge.label).toBe('PB SESSION');
  });

  it('returns improving badge when average is better but no PB', () => {
    const session = { best_lap_ms: 86000, laps: 10 };
    const context = {
      previousBestMs: 85000, // Previous best is still better
      previousSessionAvgMs: 90000,
      currentSessionAvgMs: 88000, // Better average than previous session
    };
    const badge = getSessionQualityBadge(session, context);
    expect(badge.type).toBe('improving');
    expect(badge.label).toBe('IMPROVING');
  });

  it('returns consistent badge for low stdDev and 5+ laps', () => {
    const session = { best_lap_ms: 86000, laps: 10 };
    const context = {
      previousBestMs: 85000,
      previousSessionAvgMs: 88000,
      currentSessionAvgMs: 89000, // Not improving
      currentSessionStdDev: 500, // Low standard deviation
    };
    const badge = getSessionQualityBadge(session, context);
    expect(badge.type).toBe('consistent');
    expect(badge.label).toBe('CONSISTENT');
  });

  it('returns warmup badge when no other criteria met', () => {
    const session = { best_lap_ms: 90000, laps: 3 };
    const context = {
      previousBestMs: 85000,
      previousSessionAvgMs: 88000,
      currentSessionAvgMs: 92000, // Worse average
      currentSessionStdDev: 2000, // High stdDev
    };
    const badge = getSessionQualityBadge(session, context);
    expect(badge.type).toBe('warmup');
    expect(badge.label).toBe('WARM-UP');
  });

  it('returns warmup badge when session has fewer than 5 laps even with low stdDev', () => {
    const session = { best_lap_ms: 86000, laps: 4 };
    const context = {
      previousBestMs: 85000,
      previousSessionAvgMs: 88000,
      currentSessionAvgMs: 89000,
      currentSessionStdDev: 500, // Low stdDev but not enough laps
    };
    const badge = getSessionQualityBadge(session, context);
    expect(badge.type).toBe('warmup');
  });

  it('prioritizes PB over improving', () => {
    const session = { best_lap_ms: 84000, laps: 10 };
    const context = {
      previousBestMs: 85000, // Beat this
      previousSessionAvgMs: 90000,
      currentSessionAvgMs: 86000, // Also improving
    };
    const badge = getSessionQualityBadge(session, context);
    expect(badge.type).toBe('pb');
  });

  it('prioritizes improving over consistent', () => {
    const session = { best_lap_ms: 86000, laps: 10 };
    const context = {
      previousBestMs: 85000,
      previousSessionAvgMs: 90000,
      currentSessionAvgMs: 88000, // Improving
      currentSessionStdDev: 500, // Also consistent
    };
    const badge = getSessionQualityBadge(session, context);
    expect(badge.type).toBe('improving');
  });

  it('handles null best_lap_ms gracefully', () => {
    const session = { best_lap_ms: null, laps: 5 };
    const context = {
      previousBestMs: 85000,
      currentSessionStdDev: 500,
    };
    const badge = getSessionQualityBadge(session, context);
    // Should not be PB, could be consistent or warmup
    expect(badge.type).not.toBe('pb');
  });

  it('handles missing context values gracefully', () => {
    const session = { best_lap_ms: 86000, laps: 3 };
    const context = {};
    const badge = getSessionQualityBadge(session, context);
    expect(badge.type).toBe('warmup');
  });
});

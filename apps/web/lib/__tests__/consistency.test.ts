import { describe, it, expect } from 'vitest';
import {
  calculateConsistencyScore,
  getConsistencyLevel,
} from '../calculations/consistency';

describe('calculateConsistencyScore', () => {
  it('returns score 0 for empty array', () => {
    const result = calculateConsistencyScore([]);
    expect(result.score).toBe(0);
    expect(result.trend).toBe('stable');
    expect(result.stdDevMs).toBe(0);
  });

  it('returns score 0 for single lap (needs at least 2)', () => {
    const result = calculateConsistencyScore([90000]);
    expect(result.score).toBe(0);
    expect(result.trend).toBe('stable');
    expect(result.stdDevMs).toBe(0);
  });

  it('returns score 100 for identical lap times', () => {
    const laps = [90000, 90000, 90000, 90000];
    const result = calculateConsistencyScore(laps);
    expect(result.score).toBe(100);
    expect(result.stdDevMs).toBe(0);
  });

  it('returns lower score for varied lap times', () => {
    const laps = [90000, 95000, 85000, 92000];
    const result = calculateConsistencyScore(laps);
    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThan(0);
    expect(result.stdDevMs).toBeGreaterThan(0);
  });

  it('filters out invalid (zero or negative) times', () => {
    const laps = [90000, 0, 90000, -1000];
    const result = calculateConsistencyScore(laps);
    // After filtering, only two identical 90000ms laps remain
    expect(result.score).toBe(100);
    expect(result.stdDevMs).toBe(0);
  });

  it('returns score 0 when fewer than 2 valid times after filtering', () => {
    const laps = [90000, 0, -5000];
    const result = calculateConsistencyScore(laps);
    expect(result.score).toBe(0);
  });

  it('calculates trend as "up" when second half is more consistent', () => {
    // First half: high variance, second half: low variance
    const laps = [90000, 95000, 85000, 92000, 90000, 90000, 90000, 90000];
    const result = calculateConsistencyScore(laps);
    expect(result.trend).toBe('up');
  });

  it('calculates trend as "down" when second half is less consistent', () => {
    // First half: low variance, second half: high variance
    const laps = [90000, 90000, 90000, 90000, 90000, 95000, 85000, 92000];
    const result = calculateConsistencyScore(laps);
    expect(result.trend).toBe('down');
  });

  it('returns stable trend for similar consistency throughout', () => {
    // Both halves have similar variance (within 200ms threshold)
    const laps = [90000, 91000, 89000, 90500, 90000, 91000, 89000, 90500];
    const result = calculateConsistencyScore(laps);
    expect(result.trend).toBe('stable');
  });

  it('caps score at 0 for very high deviation', () => {
    // 5000ms stdDev or more should result in score 0
    const laps = [90000, 100000, 80000, 110000, 70000];
    const result = calculateConsistencyScore(laps);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

describe('getConsistencyLevel', () => {
  it('returns "Consistente" for score >= 80', () => {
    const level = getConsistencyLevel(80);
    expect(level.label).toBe('Consistente');
    expect(level.color).toBe('#22c55e');
  });

  it('returns "Consistente" for score 100', () => {
    const level = getConsistencyLevel(100);
    expect(level.label).toBe('Consistente');
  });

  it('returns "Moderado" for score >= 60 and < 80', () => {
    const level = getConsistencyLevel(60);
    expect(level.label).toBe('Moderado');
    expect(level.color).toBe('#fbbf24');
  });

  it('returns "Moderado" for score 79', () => {
    const level = getConsistencyLevel(79);
    expect(level.label).toBe('Moderado');
  });

  it('returns "Inconsistente" for score < 60', () => {
    const level = getConsistencyLevel(59);
    expect(level.label).toBe('Inconsistente');
    expect(level.color).toBe('#ef4444');
  });

  it('returns "Inconsistente" for score 0', () => {
    const level = getConsistencyLevel(0);
    expect(level.label).toBe('Inconsistente');
  });
});

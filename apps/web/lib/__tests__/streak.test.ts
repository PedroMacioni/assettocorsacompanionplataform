import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateStreak, getSessionDates } from '../calculations/streak';

describe('calculateStreak', () => {
  beforeEach(() => {
    // Mock Date to have consistent test results
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 for empty sessions', () => {
    const result = calculateStreak([]);
    expect(result.current).toBe(0);
    expect(result.record).toBe(0);
  });

  it('returns 1 for single session today', () => {
    const today = new Date('2024-06-15T10:00:00Z');
    const result = calculateStreak([today]);
    expect(result.current).toBe(1);
    expect(result.record).toBe(1);
  });

  it('returns 1 for single session yesterday (streak still active)', () => {
    const yesterday = new Date('2024-06-14T10:00:00Z');
    const result = calculateStreak([yesterday]);
    expect(result.current).toBe(1);
    expect(result.record).toBe(1);
  });

  it('counts consecutive days correctly', () => {
    const sessions = [
      new Date('2024-06-15T10:00:00Z'), // today
      new Date('2024-06-14T15:00:00Z'), // yesterday
      new Date('2024-06-13T08:00:00Z'), // 2 days ago
    ];
    const result = calculateStreak(sessions);
    expect(result.current).toBe(3);
    expect(result.record).toBe(3);
  });

  it('breaks streak on gap', () => {
    const sessions = [
      new Date('2024-06-15T10:00:00Z'), // today
      new Date('2024-06-12T15:00:00Z'), // 3 days ago (gap of 2 days)
    ];
    const result = calculateStreak(sessions);
    expect(result.current).toBe(1);
    // Record is still 1 because each isolated session counts as 1
    expect(result.record).toBe(1);
  });

  it('returns 0 current streak if most recent session is older than yesterday', () => {
    const sessions = [
      new Date('2024-06-12T10:00:00Z'), // 3 days ago
      new Date('2024-06-11T15:00:00Z'), // 4 days ago
    ];
    const result = calculateStreak(sessions);
    expect(result.current).toBe(0);
    // Record should still reflect the consecutive days
    expect(result.record).toBe(2);
  });

  it('handles multiple sessions on the same day', () => {
    const sessions = [
      new Date('2024-06-15T10:00:00Z'), // today morning
      new Date('2024-06-15T14:00:00Z'), // today afternoon
      new Date('2024-06-15T18:00:00Z'), // today evening
      new Date('2024-06-14T12:00:00Z'), // yesterday
    ];
    const result = calculateStreak(sessions);
    // Should count as 2 days, not 4
    expect(result.current).toBe(2);
    expect(result.record).toBe(2);
  });

  it('calculates record streak separate from current', () => {
    const sessions = [
      new Date('2024-06-15T10:00:00Z'), // today (current streak starts)
      // Gap
      new Date('2024-06-10T10:00:00Z'), // 5 days ago
      new Date('2024-06-09T10:00:00Z'), // 6 days ago
      new Date('2024-06-08T10:00:00Z'), // 7 days ago
      new Date('2024-06-07T10:00:00Z'), // 8 days ago (4-day streak in history)
    ];
    const result = calculateStreak(sessions);
    expect(result.current).toBe(1);
    expect(result.record).toBe(4);
  });

  it('handles dates in random order', () => {
    const sessions = [
      new Date('2024-06-13T10:00:00Z'),
      new Date('2024-06-15T10:00:00Z'),
      new Date('2024-06-14T10:00:00Z'),
    ];
    const result = calculateStreak(sessions);
    expect(result.current).toBe(3);
    expect(result.record).toBe(3);
  });
});

describe('getSessionDates', () => {
  it('converts session objects to Date array', () => {
    const sessions = [
      { started_at: '2024-06-15T10:00:00Z' },
      { started_at: '2024-06-14T15:00:00Z' },
    ];
    const dates = getSessionDates(sessions);
    expect(dates).toHaveLength(2);
    expect(dates[0]).toBeInstanceOf(Date);
    expect(dates[1]).toBeInstanceOf(Date);
  });

  it('returns empty array for empty sessions', () => {
    const dates = getSessionDates([]);
    expect(dates).toEqual([]);
  });
});

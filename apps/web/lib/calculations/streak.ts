/**
 * Calculate the current streak of consecutive days with sessions.
 * A streak is broken if there's a gap of 1+ day without sessions.
 */
export function calculateStreak(sessionDates: Date[]): { current: number; record: number } {
  if (sessionDates.length === 0) {
    return { current: 0, record: 0 };
  }

  // Get unique dates (YYYY-MM-DD) sorted descending
  const uniqueDates = [...new Set(
    sessionDates.map(d => d.toISOString().split('T')[0])
  )].sort((a, b) => b.localeCompare(a));

  if (uniqueDates.length === 0) {
    return { current: 0, record: 0 };
  }

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Check if streak is active (session today or yesterday)
  const streakActive = uniqueDates[0] === today || uniqueDates[0] === yesterday;

  // Calculate current streak
  let currentStreak = 0;
  if (streakActive) {
    currentStreak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = new Date(uniqueDates[i - 1]);
      const currDate = new Date(uniqueDates[i]);
      const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / 86400000);

      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate record streak (longest consecutive run in history)
  let recordStreak = 1;
  let tempStreak = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(uniqueDates[i - 1]);
    const currDate = new Date(uniqueDates[i]);
    const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / 86400000);

    if (diffDays === 1) {
      tempStreak++;
      recordStreak = Math.max(recordStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  return {
    current: currentStreak,
    record: Math.max(recordStreak, currentStreak),
  };
}

/**
 * Transform raw session data into dates for streak calculation.
 */
export function getSessionDates(sessions: Array<{ started_at: string }>): Date[] {
  return sessions.map(s => new Date(s.started_at));
}

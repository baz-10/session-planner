/**
 * Time calculation utilities for session planning
 */

/**
 * Format minutes to HH:MM or H:MM format
 */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Parse time string (HH:MM) to minutes from midnight
 */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes from midnight to time string (HH:MM)
 */
export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Format time for display (e.g., "5:00 PM")
 */
export function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Calculate time range for an activity
 */
export function calculateTimeRange(
  startMinutes: number,
  durationMinutes: number
): { start: string; end: string } {
  const endMinutes = startMinutes + durationMinutes;
  return {
    start: minutesToTimeString(startMinutes),
    end: minutesToTimeString(endMinutes),
  };
}

/**
 * Calculate cumulative times for a list of activities
 */
export interface ActivityTiming {
  id: string;
  duration: number;
  cumulativeMinutes: number;
  startTime: string;
  endTime: string;
  minutesRemaining: number;
}

export function calculateActivityTimings(
  activities: Array<{ id: string; duration: number }>,
  sessionStartTime: string,
  totalDuration: number
): ActivityTiming[] {
  const startMinutes = parseTimeToMinutes(sessionStartTime);
  let cumulative = 0;

  return activities.map((activity) => {
    const activityStart = startMinutes + cumulative;
    const { start, end } = calculateTimeRange(activityStart, activity.duration);
    cumulative += activity.duration;

    return {
      id: activity.id,
      duration: activity.duration,
      cumulativeMinutes: cumulative,
      startTime: start,
      endTime: end,
      minutesRemaining: Math.max(0, totalDuration - cumulative),
    };
  });
}

/**
 * Calculate time allocation by category
 */
export interface CategoryAllocation {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  minutes: number;
  percentage: number;
}

export function calculateCategoryAllocations(
  activities: Array<{ duration: number; category_id: string | null; category?: { name: string; color: string } | null }>,
  totalDuration: number,
  _categoryLookup?: Map<string, { name: string; color: string }>,
  _drillCategoryIdsByDrillId?: Record<string, string[]>
): CategoryAllocation[] {
  const categoryMap = new Map<string | null, { name: string; color: string; minutes: number }>();

  activities.forEach((activity) => {
    const categoryId = activity.category_id;
    const existing = categoryMap.get(categoryId);

    if (existing) {
      existing.minutes += activity.duration;
    } else {
      categoryMap.set(categoryId, {
        name: activity.category?.name || 'Uncategorized',
        color: activity.category?.color || '#94a3b8',
        minutes: activity.duration,
      });
    }
  });

  const totalMinutes = activities.reduce((sum, a) => sum + a.duration, 0);
  const remainingMinutes = Math.max(0, totalDuration - totalMinutes);

  const allocations: CategoryAllocation[] = Array.from(categoryMap.entries()).map(
    ([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      categoryColor: data.color,
      minutes: data.minutes,
      percentage: totalDuration > 0 ? (data.minutes / totalDuration) * 100 : 0,
    })
  );

  // Add remaining time if any
  if (remainingMinutes > 0) {
    allocations.push({
      categoryId: null,
      categoryName: 'Min Remaining',
      categoryColor: '#e5e7eb',
      minutes: remainingMinutes,
      percentage: totalDuration > 0 ? (remainingMinutes / totalDuration) * 100 : 0,
    });
  }

  return allocations;
}

/**
 * Format duration for display
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

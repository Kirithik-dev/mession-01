/**
 * MISSION Alarm Time Calculation and Formatting Utilities
 * Handles next-occurrence determination across midnight and multi-day schedules,
 * live concise countdown math, and human-readable time formatting.
 */

export interface MissionAlarm {
  id: string;
  time: string; // "HH:MM" 24h format e.g. "07:00"
  label: string; // e.g. "Morning Shift"
  repeatDays: number[]; // [0, 1, 2, 3, 4, 5, 6] (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  enabled: boolean;
}

export const DEFAULT_ALARMS: MissionAlarm[] = [
  {
    id: 'alarm-default-1',
    time: '07:00',
    label: 'Morning Shift',
    repeatDays: [1, 2, 3, 4, 5], // Monday - Friday
    enabled: true,
  },
  {
    id: 'alarm-default-2',
    time: '08:30',
    label: 'Weekend Drift',
    repeatDays: [0, 6], // Saturday & Sunday
    enabled: false,
  },
];

/**
 * Calculates the exact next Date when an alarm will trigger.
 * Handles today vs tomorrow and specific repeat days (0=Sun, 1=Mon, ..., 6=Sat).
 */
export function getNextAlarmOccurrence(
  timeStr: string,
  repeatDays: number[] = []
): Date {
  if (!timeStr || !timeStr.includes(':')) {
    return new Date();
  }

  const [targetH, targetM] = timeStr.split(':').map(Number);
  const now = new Date();

  // If specific repeat days are selected
  if (repeatDays.length > 0) {
    for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + dayOffset);
      candidate.setHours(targetH, targetM, 0, 0);

      const candidateDayOfWeek = candidate.getDay(); // 0 = Sunday
      if (repeatDays.includes(candidateDayOfWeek)) {
        if (dayOffset === 0) {
          // If today, must be in the future
          if (candidate.getTime() > now.getTime()) {
            return candidate;
          }
        } else {
          return candidate;
        }
      }
    }
  }

  // Default: Daily schedule (repeats every day)
  const todayCandidate = new Date(now);
  todayCandidate.setHours(targetH, targetM, 0, 0);

  if (todayCandidate.getTime() > now.getTime()) {
    return todayCandidate;
  }

  // Target time already passed today; next occurrence is tomorrow
  const tomorrowCandidate = new Date(now);
  tomorrowCandidate.setDate(tomorrowCandidate.getDate() + 1);
  tomorrowCandidate.setHours(targetH, targetM, 0, 0);
  return tomorrowCandidate;
}

/**
 * Finds the earliest upcoming active alarm from a list of alarms.
 */
export function findNextActiveAlarm(
  alarms: MissionAlarm[]
): { alarm: MissionAlarm; nextDate: Date } | null {
  const activeAlarms = alarms.filter((a) => a.enabled && Boolean(a.time));
  if (activeAlarms.length === 0) return null;

  let earliest: { alarm: MissionAlarm; nextDate: Date } | null = null;

  for (const alarm of activeAlarms) {
    const nextDate = getNextAlarmOccurrence(alarm.time, alarm.repeatDays);
    if (!earliest || nextDate.getTime() < earliest.nextDate.getTime()) {
      earliest = { alarm, nextDate };
    }
  }

  return earliest;
}

/**
 * Calculates remaining hours, minutes, and seconds until the target Date.
 */
export function getRemainingCountdown(targetDate: Date): {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
} {
  const now = new Date();
  const diffMs = Math.max(0, targetDate.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { hours, minutes, seconds, totalSeconds };
}

/**
 * Formats a reactive concise countdown string (e.g. "6 HOURS LEFT", "30 MIN LEFT").
 * Directly satisfies the requirement to eliminate separate HOURS/MINUTES/SECONDS boxes.
 */
export function formatConciseCountdown(targetDate: Date): string {
  const now = new Date();
  const diffMs = Math.max(0, targetDate.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);

  if (totalSeconds <= 0) {
    return 'DUE NOW';
  }

  if (totalSeconds < 60) {
    return `${Math.max(1, totalSeconds)} SEC LEFT`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours < 1) {
    return `${Math.max(1, minutes)} MIN LEFT`;
  }

  // When 1 hour or more
  if (minutes === 0) {
    return `${hours} ${hours === 1 ? 'HOUR' : 'HOURS'} LEFT`;
  }

  // Concise format: e.g. "6 HOURS LEFT" or "6H 30M LEFT"
  return `${hours} ${hours === 1 ? 'HOUR' : 'HOURS'} LEFT`;
}

/**
 * Formats a 24h time string ("07:00") into a clean 12h display ("07:00 AM").
 */
export function formatTime12h(time24: string): {
  formatted: string;
  hour12: string;
  minute: string;
  ampm: 'AM' | 'PM';
} {
  if (!time24 || !time24.includes(':')) {
    return { formatted: '07:00 AM', hour12: '07', minute: '00', ampm: 'AM' };
  }

  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr.padStart(2, '0');
  const ampm: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';

  h = h % 12;
  if (h === 0) h = 12;
  const hour12 = String(h).padStart(2, '0');

  return {
    formatted: `${hour12}:${m} ${ampm}`,
    hour12,
    minute: m,
    ampm,
  };
}

/**
 * Human-readable summary of repeat days schedule.
 */
export function formatRepeatDays(repeatDays: number[]): string {
  if (!repeatDays || repeatDays.length === 0) return 'ONCE';
  if (repeatDays.length === 7) return 'EVERY DAY';
  if (
    repeatDays.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => repeatDays.includes(d))
  ) {
    return 'WEEKDAYS';
  }
  if (repeatDays.length === 2 && [0, 6].every((d) => repeatDays.includes(d))) {
    return 'WEEKENDS';
  }

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return repeatDays.map((d) => dayNames[d]).join(', ');
}

/**
 * MISSION Persistent Alarm Configuration & Scheduling Engine
 * 
 * Provides:
 * - Deterministic, wall-clock local scheduling across midnight, week, and timezone boundaries
 * - Single source of truth with versioned persistence and legacy migration
 * - Robust validation against malformed, corrupted, or out-of-bounds inputs
 * - Decoupled execution interfaces for upcoming alarm queries and alarm firing events
 * - Pure formatting functions for concise reactive countdowns and 12h time
 */

import {
  AlarmItem,
  AlarmOccurrence,
  AlarmStoragePayload,
  DayOfWeek,
} from '../types/alarm';
import { recordAppError } from './errorCentre';

export const STORAGE_KEY_ALARMS_V3 = 'mission_alarms_v3';
export const STORAGE_KEY_ALARMS_V2 = 'mission_alarms_v2';
export const STORAGE_KEY_MASTER = 'mission_master_alarm_on';

/**
 * Standard default alarms seeded when no prior configuration exists
 */
export const DEFAULT_CANONICAL_ALARMS: AlarmItem[] = [
  {
    id: 'alarm_default_shift',
    time: '07:00',
    hour: 7,
    minute: 0,
    label: 'Morning Shift',
    repeatDays: [1, 2, 3, 4, 5], // Monday - Friday
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastTriggeredAt: null,
  },
  {
    id: 'alarm_default_drift',
    time: '08:30',
    hour: 8,
    minute: 30,
    label: 'Weekend Drift',
    repeatDays: [0, 6], // Saturday & Sunday
    enabled: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastTriggeredAt: null,
  },
];

// ============================================================================
// 1. INJECTABLE CLOCK PROVIDER
// ============================================================================

let clockOverride: (() => Date) | null = null;

/**
 * Injects a mock or fixed clock function for deterministic testing
 */
export function setAlarmClockOverride(fn: (() => Date) | null): void {
  clockOverride = fn;
}

/**
 * Returns current local time using the active clock provider
 */
export function getAlarmCurrentTime(): Date {
  return clockOverride ? clockOverride() : new Date();
}

/**
 * Generates a stable unique identifier for alarm records
 */
export function generateAlarmId(): string {
  const ts = Date.now();
  const rnd = Math.random().toString(36).substring(2, 8);
  return `alarm_${ts}_${rnd}`;
}

// ============================================================================
// 2. VALIDATION & SANITIZATION
// ============================================================================

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Validates whether a given string is a valid "HH:MM" 24h format
 */
export function isValidTimeString(timeStr: unknown): timeStr is string {
  if (typeof timeStr !== 'string') return false;
  return TIME_REGEX.test(timeStr);
}

/**
 * Parses a valid 24h time string into numerical hour and minute
 */
export function parseTimeString(timeStr: string): { hour: number; minute: number } {
  if (!isValidTimeString(timeStr)) {
    return { hour: 7, minute: 0 };
  }
  const [hStr, mStr] = timeStr.split(':');
  return {
    hour: parseInt(hStr, 10),
    minute: parseInt(mStr, 10),
  };
}

/**
 * Validates and normalizes repeat days to unique DayOfWeek values [0-6] sorted ascending
 */
export function sanitizeRepeatDays(rawDays: unknown): number[] {
  if (!Array.isArray(rawDays)) {
    return [];
  }
  const validDays = new Set<DayOfWeek>();
  for (const item of rawDays) {
    const num = Number(item);
    if (Number.isInteger(num) && num >= 0 && num <= 6) {
      validDays.add(num as DayOfWeek);
    }
  }
  return Array.from(validDays).sort((a, b) => a - b);
}

/**
 * Sanitizes an unknown input into a well-formed AlarmItem or returns null if irrecoverable
 */
export function validateAndSanitizeAlarm(raw: unknown, fallbackId?: string): AlarmItem | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  // ID validation
  const id =
    typeof obj.id === 'string' && obj.id.trim().length > 0
      ? obj.id.trim()
      : fallbackId || generateAlarmId();

  // Time validation
  let timeStr = '07:00';
  if (isValidTimeString(obj.time)) {
    timeStr = obj.time;
  } else if (
    typeof obj.hour === 'number' &&
    typeof obj.minute === 'number' &&
    obj.hour >= 0 &&
    obj.hour <= 23 &&
    obj.minute >= 0 &&
    obj.minute <= 59
  ) {
    timeStr = `${String(obj.hour).padStart(2, '0')}:${String(obj.minute).padStart(2, '0')}`;
  }

  const { hour, minute } = parseTimeString(timeStr);

  // Label validation
  const label =
    typeof obj.label === 'string' && obj.label.trim().length > 0
      ? obj.label.trim().slice(0, 32)
      : 'Alarm';

  // Enabled status
  const enabled = typeof obj.enabled === 'boolean' ? obj.enabled : true;

  // Repeat schedule ([] = one-time alarm)
  const repeatDays = sanitizeRepeatDays(obj.repeatDays);

  // Timestamps
  const nowIso = new Date().toISOString();
  const createdAt =
    typeof obj.createdAt === 'string' && !isNaN(Date.parse(obj.createdAt))
      ? obj.createdAt
      : nowIso;
  const updatedAt =
    typeof obj.updatedAt === 'string' && !isNaN(Date.parse(obj.updatedAt))
      ? obj.updatedAt
      : nowIso;
  const lastTriggeredAt =
    typeof obj.lastTriggeredAt === 'string' && !isNaN(Date.parse(obj.lastTriggeredAt))
      ? obj.lastTriggeredAt
      : null;

  return {
    id,
    time: timeStr,
    hour,
    minute,
    label,
    enabled,
    repeatDays,
    createdAt,
    updatedAt,
    lastTriggeredAt,
  };
}

// ============================================================================
// 3. SCHEDULING & OCCURRENCE CALCULATIONS
// ============================================================================

/**
 * Calculates the exact next Date when an enabled alarm will trigger based on local wall-clock time.
 * 
 * Rules:
 * 1. Disabled alarms return null.
 * 2. One-time alarms (repeatDays = []):
 *    - If target time is strictly later today: triggers TODAY.
 *    - If target time has already passed or is right now today: rolls over to TOMORROW.
 * 3. Repeating alarms (repeatDays != []):
 *    - Iterates over the next 7 days in wall-clock time.
 *    - For today (offset = 0), candidate is accepted only if its time is in the future.
 *    - For offsets 1..7, candidate is accepted if its day-of-week matches repeatDays.
 * 4. All calculations construct local Date instances to strictly respect local calendar wall-clock.
 */
export function calculateNextOccurrence(
  alarm: AlarmItem,
  referenceDate?: Date
): Date | null {
  if (!alarm.enabled) {
    return null;
  }

  const ref = referenceDate ? new Date(referenceDate) : getAlarmCurrentTime();
  if (isNaN(ref.getTime())) {
    return null;
  }

  const targetH = alarm.hour;
  const targetM = alarm.minute;
  const refTime = ref.getTime();

  // Case A: One-time alarm (empty repeatDays)
  if (alarm.repeatDays.length === 0) {
    const todayCandidate = new Date(
      ref.getFullYear(),
      ref.getMonth(),
      ref.getDate(),
      targetH,
      targetM,
      0,
      0
    );

    // If target time is strictly in the future today
    if (todayCandidate.getTime() > refTime) {
      return todayCandidate;
    }

    // Otherwise it rolls over to tomorrow
    const tomorrowCandidate = new Date(
      ref.getFullYear(),
      ref.getMonth(),
      ref.getDate() + 1,
      targetH,
      targetM,
      0,
      0
    );
    return tomorrowCandidate;
  }

  // Case B: Repeating alarm with explicit days of the week [0-6]
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidate = new Date(
      ref.getFullYear(),
      ref.getMonth(),
      ref.getDate() + dayOffset,
      targetH,
      targetM,
      0,
      0
    );

    const dayOfWeek = candidate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    if (alarm.repeatDays.includes(dayOfWeek)) {
      if (dayOffset === 0) {
        // Must be in the future if today
        if (candidate.getTime() > refTime) {
          return candidate;
        }
      } else {
        return candidate;
      }
    }
  }

  // Fallback: 7 days ahead
  return new Date(
    ref.getFullYear(),
    ref.getMonth(),
    ref.getDate() + 7,
    targetH,
    targetM,
    0,
    0
  );
}

/**
 * Finds the earliest upcoming active alarm from a list of alarms.
 * Resolves ties deterministically:
 * 1. Earliest nextDate
 * 2. Earlier createdAt timestamp
 * 3. Lexicographical ID comparison
 */
export function getNextUpcomingAlarm(
  alarms: AlarmItem[],
  referenceDate?: Date
): AlarmOccurrence | null {
  const ref = referenceDate ? new Date(referenceDate) : getAlarmCurrentTime();
  if (isNaN(ref.getTime())) return null;

  const activeAlarms = alarms.filter((a) => a.enabled);
  if (activeAlarms.length === 0) return null;

  const occurrences: AlarmOccurrence[] = [];

  for (const alarm of activeAlarms) {
    const nextDate = calculateNextOccurrence(alarm, ref);
    if (!nextDate) continue;

    const diffMs = Math.max(0, nextDate.getTime() - ref.getTime());
    const isToday =
      nextDate.getFullYear() === ref.getFullYear() &&
      nextDate.getMonth() === ref.getMonth() &&
      nextDate.getDate() === ref.getDate();

    occurrences.push({
      alarm,
      nextDate,
      diffMs,
      isToday,
      formattedTime12: formatTime12h(alarm.time),
    });
  }

  if (occurrences.length === 0) return null;

  // Deterministic sorting
  occurrences.sort((a, b) => {
    const timeDiff = a.nextDate.getTime() - b.nextDate.getTime();
    if (timeDiff !== 0) return timeDiff;

    // Tie-breaker 1: earlier createdAt
    const createdDiff = (a.alarm.createdAt || '').localeCompare(b.alarm.createdAt || '');
    if (createdDiff !== 0) return createdDiff;

    // Tie-breaker 2: id
    return a.alarm.id.localeCompare(b.alarm.id);
  });

  return occurrences[0];
}

// Backward-compatible alias for existing components
export function findNextActiveAlarm(
  alarms: AlarmItem[],
  referenceDate?: Date
): { alarm: AlarmItem; nextDate: Date } | null {
  const occurrence = getNextUpcomingAlarm(alarms, referenceDate);
  if (!occurrence) return null;
  return { alarm: occurrence.alarm, nextDate: occurrence.nextDate };
}

// ============================================================================
// 4. FORMATTING & COUNTDOWN DISPLAY UTILITIES
// ============================================================================

/**
 * Formats a 24h time string ("07:00") into a clean 12h display ("07:00 AM")
 */
export function formatTime12h(time24: string): {
  formatted: string;
  hour12: string;
  minute: string;
  ampm: 'AM' | 'PM';
} {
  const { hour, minute } = parseTimeString(time24);
  const m = String(minute).padStart(2, '0');
  const ampm: 'AM' | 'PM' = hour >= 12 ? 'PM' : 'AM';

  let h12 = hour % 12;
  if (h12 === 0) h12 = 12;
  const hour12 = String(h12).padStart(2, '0');

  return {
    formatted: `${hour12}:${m} ${ampm}`,
    hour12,
    minute: m,
    ampm,
  };
}

/**
 * Returns human-readable summary of repeat days schedule
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

/**
 * Formats concise reactive alarm countdown text (e.g. "6 HOURS LEFT", "30 MIN LEFT", "DUE NOW")
 */
export function formatConciseCountdown(
  targetDate: Date,
  referenceDate?: Date
): string {
  const ref = referenceDate ? new Date(referenceDate) : getAlarmCurrentTime();
  const diffMs = Math.max(0, targetDate.getTime() - ref.getTime());
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

  return `${hours} ${hours === 1 ? 'HOUR' : 'HOURS'} LEFT`;
}

// ============================================================================
// 5. STORAGE & MIGRATION ENGINE
// ============================================================================

/**
 * Loads stored alarms with versioned schema handling and automatic migration
 */
export function loadStoredAlarms(): AlarmItem[] {
  try {
    // 1. Try V3 versioned container
    const rawV3 = localStorage.getItem(STORAGE_KEY_ALARMS_V3);
    if (rawV3) {
      const parsed = JSON.parse(rawV3);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.alarms)) {
        const sanitizedList = parsed.alarms
          .map((item: unknown) => validateAndSanitizeAlarm(item))
          .filter((a: AlarmItem | null): a is AlarmItem => a !== null);

        if (sanitizedList.length > 0) {
          return sanitizedList;
        }
      }
    }

    // 2. Fall back to V2 legacy array format and migrate
    const rawV2 = localStorage.getItem(STORAGE_KEY_ALARMS_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const migratedList = parsed
          .map((item: unknown) => validateAndSanitizeAlarm(item))
          .filter((a: AlarmItem | null): a is AlarmItem => a !== null);

        if (migratedList.length > 0) {
          // Persist upgraded schema
          saveStoredAlarms(migratedList);
          return migratedList;
        }
      }
    }
  } catch (error) {
    recordAppError({
      operation: 'alarm_storage_read',
      title: 'Failed to read alarm storage',
      message: 'Alarm preferences could not be parsed from local storage. Fallback defaults restored.',
      severity: 'warning',
      technicalDetails: error instanceof Error ? error.message : String(error),
    });
  }

  return DEFAULT_CANONICAL_ALARMS;
}

/**
 * Persists alarms atomically into versioned storage and keeps V2 synchronized for backup compatibility
 */
export function saveStoredAlarms(alarms: AlarmItem[]): boolean {
  try {
    const payload: AlarmStoragePayload = {
      version: 3,
      alarms,
      updatedAt: new Date().toISOString(),
    };

    const v3Json = JSON.stringify(payload);
    const v2Json = JSON.stringify(alarms);

    localStorage.setItem(STORAGE_KEY_ALARMS_V3, v3Json);
    localStorage.setItem(STORAGE_KEY_ALARMS_V2, v2Json);
    return true;
  } catch (error) {
    recordAppError({
      operation: 'alarm_storage_write',
      title: 'Alarm save failure',
      message: 'Failed to write updated alarm schedule to device storage. Storage may be full or restricted.',
      severity: 'critical',
      technicalDetails: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Loads master switch power state
 */
export function loadMasterPowerState(initialAlarms: AlarmItem[]): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MASTER);
    if (saved !== null) {
      return JSON.parse(saved) === true;
    }
  } catch {
    // ignore
  }
  return initialAlarms.some((a) => a.enabled);
}

/**
 * Persists master switch power state
 */
export function saveMasterPowerState(isOn: boolean): boolean {
  try {
    localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify(isOn));
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// 6. DECOUPLED NATIVE EXECUTION INTERFACES
// ============================================================================

/**
 * Returns all currently armed and valid alarms
 */
export function getEnabledAlarms(alarms?: AlarmItem[]): AlarmItem[] {
  const list = alarms || loadStoredAlarms();
  return list.filter((a) => a.enabled);
}

/**
 * Gets the next upcoming alarm occurrence across all stored alarms
 */
export function getUpcomingAlarmOccurrence(referenceDate?: Date): AlarmOccurrence | null {
  const alarms = loadStoredAlarms();
  return getNextUpcomingAlarm(alarms, referenceDate);
}

/**
 * Dispatches alarm firing event.
 * If the alarm is a one-time alarm (repeatDays = []), it is automatically disarmed (enabled = false)
 * without deleting the user's configuration, so they can re-arm or adjust it later.
 * Repeating alarms remain enabled and record lastTriggeredAt.
 */
export function handleAlarmFired(
  alarmId: string,
  currentAlarms?: AlarmItem[]
): {
  updatedAlarm: AlarmItem | null;
  remainingAlarms: AlarmItem[];
  disarmedOneTime: boolean;
} {
  const alarms = currentAlarms ? [...currentAlarms] : loadStoredAlarms();
  const index = alarms.findIndex((a) => a.id === alarmId);

  if (index === -1) {
    return {
      updatedAlarm: null,
      remainingAlarms: alarms,
      disarmedOneTime: false,
    };
  }

  const target = alarms[index];
  const nowIso = new Date().toISOString();
  const isOneTime = target.repeatDays.length === 0;

  const updatedAlarm: AlarmItem = {
    ...target,
    enabled: isOneTime ? false : target.enabled,
    lastTriggeredAt: nowIso,
    updatedAt: nowIso,
  };

  alarms[index] = updatedAlarm;
  saveStoredAlarms(alarms);

  return {
    updatedAlarm,
    remainingAlarms: alarms,
    disarmedOneTime: isOneTime,
  };
}

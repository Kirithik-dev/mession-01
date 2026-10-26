/**
 * MISSION Alarm Time Calculation and Formatting Utilities
 * 
 * Re-exports the unified Alarm Engine and provides backward-compatible adapters.
 */

import {
  AlarmItem,
  MissionAlarm,
} from '../types/alarm';
import {
  calculateNextOccurrence,
  findNextActiveAlarm,
  formatConciseCountdown,
  formatRepeatDays,
  formatTime12h,
  getAlarmCurrentTime,
  parseTimeString,
  DEFAULT_CANONICAL_ALARMS,
} from './alarmEngine';

export type { MissionAlarm, AlarmItem };
export {
  findNextActiveAlarm,
  formatConciseCountdown,
  formatRepeatDays,
  formatTime12h,
  getAlarmCurrentTime,
};

export const DEFAULT_ALARMS: MissionAlarm[] = DEFAULT_CANONICAL_ALARMS;

/**
 * Calculates the exact next Date when an alarm will trigger.
 * Adapter for legacy function signature (timeStr, repeatDays).
 */
export function getNextAlarmOccurrence(
  timeStr: string,
  repeatDays: number[] = [],
  referenceDate?: Date
): Date {
  const { hour, minute } = parseTimeString(timeStr);
  const syntheticAlarm: AlarmItem = {
    id: 'temp',
    time: timeStr,
    hour,
    minute,
    label: '',
    enabled: true,
    repeatDays,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const next = calculateNextOccurrence(syntheticAlarm, referenceDate);
  return next || new Date();
}

/**
 * Calculates remaining hours, minutes, and seconds until the target Date.
 */
export function getRemainingCountdown(
  targetDate: Date,
  referenceDate?: Date
): {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
} {
  const now = referenceDate ? new Date(referenceDate) : getAlarmCurrentTime();
  const diffMs = Math.max(0, targetDate.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { hours, minutes, seconds, totalSeconds };
}

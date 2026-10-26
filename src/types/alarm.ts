/**
 * MISSION Alarm Engine Type Definitions
 * 
 * Defines the canonical data structures for alarm configuration, scheduling,
 * persistence, trigger state machines, and decoupled native execution interfaces.
 */

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

/**
 * Canonical Alarm Record
 * Fully validated, serializable, and persistent alarm representation.
 */
export interface AlarmItem {
  id: string; // Stable unique ID (e.g. "alarm_1729900000000_abcd")
  time: string; // Validated "HH:MM" 24-hour string (e.g. "07:30")
  hour: number; // Parsed 24-hour component [0-23]
  minute: number; // Parsed minute component [0-59]
  label: string; // Human-readable user label (e.g. "Morning Shift")
  enabled: boolean; // Current arming status
  repeatDays: number[]; // Array of DayOfWeek [0-6]. Empty array [] indicates a ONE-TIME alarm
  createdAt: string; // ISO 8601 creation timestamp
  updatedAt: string; // ISO 8601 last modified timestamp
  lastTriggeredAt?: string | null; // ISO 8601 timestamp when alarm last fired
}

/**
 * Backward-compatible alias for existing components
 */
export type MissionAlarm = AlarmItem;

/**
 * Next scheduled alarm occurrence event
 */
export interface AlarmOccurrence {
  alarm: AlarmItem;
  nextDate: Date;
  diffMs: number;
  isToday: boolean;
  formattedTime12: {
    formatted: string;
    hour12: string;
    minute: string;
    ampm: 'AM' | 'PM';
  };
}

/**
 * Versioned storage payload for atomic persistence and migrations
 */
export interface AlarmStoragePayload {
  version: 3;
  alarms: AlarmItem[];
  updatedAt: string;
}

/**
 * Partial user input for creating or editing an alarm
 */
export interface AlarmInput {
  id?: string;
  time: string;
  label?: string;
  repeatDays?: number[];
  enabled?: boolean;
}

export interface AlarmValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: AlarmItem;
}

// ============================================================================
// ALARM TRIGGER STATE MACHINE & EXECUTION TYPES
// ============================================================================

export type AlarmSessionStatus =
  | 'scheduled'
  | 'ringing'
  | 'snoozed'
  | 'stopped'
  | 'completed';

export interface AlarmSession {
  sessionId: string; // Unique session identifier
  alarmId: string; // ID of the triggering alarm
  alarmLabel: string; // Label of the triggering alarm
  occurrenceId: string; // Stable occurrence identifier (prevents duplicate triggers)
  scheduledTime: string; // ISO 8601 timestamp of intended trigger
  triggeredAt: string; // ISO 8601 timestamp when ringing was initiated
  status: AlarmSessionStatus;
  snoozeCount: number; // Number of times this session has been snoozed
  snoozeDurationMinutes: number; // Configurable duration in minutes
  snoozeUntil?: string | null; // ISO 8601 timestamp when next ring is due if snoozed
  stoppedAt?: string | null; // ISO 8601 timestamp when stopped
  completedAt?: string | null; // ISO 8601 timestamp when completed
  resolvedTrackId?: string | null; // Selected daily track ID or null
  trackTitle?: string | null; // Selected track title or fallback name
  hasAudio: boolean; // Whether audio binary is available
  audioFallbackUsed?: boolean; // True if fallback audio had to be used
  metadata?: Record<string, unknown>;
}

export interface DueAlarmMatch {
  alarm: AlarmItem;
  occurrenceDate: Date;
  occurrenceId: string;
  diffMs: number;
}

export interface AudioResolutionResult {
  trackId: string | null;
  title: string;
  blob: Blob | null;
  url?: string;
  isFallback: boolean;
  reason?: string;
}

export type AlarmSessionListener = (session: AlarmSession | null) => void;

export interface AlarmCoordinatorConfig {
  snoozeDurationMinutes?: number; // Default: 9
  dueToleranceMs?: number; // Default: 60,000 ms (1 minute)
  pollIntervalMs?: number; // Default: 1,000 ms
  audioResolver?: (trackId: string | null) => Promise<AudioResolutionResult>;
}

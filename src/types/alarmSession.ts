/**
 * MISSION Alarm Trigger & Session State Machine Types
 * 
 * Defines state models, active sessions, audio adapters, and transitions.
 */

export type AlarmSessionStatus =
  | 'scheduled'
  | 'ringing'
  | 'snoozed'
  | 'stopped'
  | 'completed';

/**
 * Explicit active alarm session representation
 */
export interface ActiveAlarmSession {
  sessionId: string; // Unique session ID: e.g. "session_1729900000_abcd"
  alarmId: string; // Target AlarmItem.id
  alarmLabel: string;
  alarmTime: string; // "HH:MM"
  occurrenceId: string; // Stable deterministic occurrence identifier
  scheduledTime: string; // ISO 8601 string of the scheduled trigger time
  triggeredAt: string; // ISO 8601 string when ringing began
  updatedAt: string; // ISO 8601 timestamp of last state transition
  status: AlarmSessionStatus;
  snoozeCount: number;
  snoozeDurationMinutes: number; // Configurable duration in minutes (default: 5)
  snoozeUntil?: string | null; // ISO 8601 string if currently snoozed
  resolvedTrackId?: string | null; // Exact daily track ID resolved from vault
  trackTitle?: string | null;
  trackSource?: string | null;
  hasAudio: boolean;
  errorDetails?: string | null;
}

/**
 * Audio execution adapter interface for web and future native Android MediaPlayer
 */
export interface AlarmAudioAdapter {
  playAlarmAudio(trackId: string | null, src?: string | null): Promise<boolean>;
  stopAlarmAudio(): void;
  pauseAlarmAudio(): void;
  isPlaying(): boolean;
}

/**
 * Result returned by the coordinator on each scheduling tick
 */
export interface CoordinatorTickResult {
  triggered: boolean;
  session: ActiveAlarmSession | null;
  reason?: string;
}

/**
 * Resolved audio data for an alarm session
 */
export interface ResolvedAlarmAudio {
  trackId: string | null;
  trackTitle: string | null;
  trackSource: string | null;
  hasAudio: boolean;
  error?: string;
}

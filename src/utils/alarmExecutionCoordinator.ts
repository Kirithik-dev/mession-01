/**
 * MISSION Alarm Trigger State Machine & Execution Coordinator
 * 
 * Central coordinator responsible for:
 * 1. Identifying due alarms via wall-clock time and stable occurrence IDs.
 * 2. Enforcing state transitions: scheduled -> ringing -> snoozed -> stopped -> completed.
 * 3. Idempotent Stop and Snooze operations.
 * 4. Resolving the day's exact track via getDailyTrackId() and audio vault with fallback resilience.
 * 5. Preserving one-time alarm disarm lifecycle upon execution without affecting repeating schedules.
 * 6. Preventing duplicate playback and concurrent execution race conditions.
 * 7. Recovery across application restarts.
 */

import {
  AlarmItem,
  AlarmSession,
  AlarmSessionListener,
  AlarmSessionStatus,
  AudioResolutionResult,
  DueAlarmMatch,
} from '../types/alarm';
import {
  getAlarmCurrentTime,
  handleAlarmFired,
  loadStoredAlarms,
} from './alarmEngine';
import { getDailyTrackId } from './dailySelectionService';
import { getAudioFromVault } from './audioStorage';
import { recordAppError } from './errorCentre';

export const STORAGE_KEY_ACTIVE_SESSION = 'mission_alarm_active_session_v1';
export const STORAGE_KEY_HANDLED_OCCURRENCES = 'mission_alarm_handled_occurrences_v1';
export const DEFAULT_SNOOZE_DURATION_MINUTES = 9;
export const DEFAULT_DUE_TOLERANCE_MS = 60000; // 60 seconds

// ============================================================================
// 1. STABLE OCCURRENCE IDENTIFIER & HANDLED STORE
// ============================================================================

/**
 * Constructs a deterministic, collision-proof occurrence identifier
 * e.g. "alarm_123:2026-06-10T07:00:00"
 */
export function generateOccurrenceId(alarmId: string, occurrenceDate: Date): string {
  const y = occurrenceDate.getFullYear();
  const m = String(occurrenceDate.getMonth() + 1).padStart(2, '0');
  const d = String(occurrenceDate.getDate()).padStart(2, '0');
  const hh = String(occurrenceDate.getHours()).padStart(2, '0');
  const mm = String(occurrenceDate.getMinutes()).padStart(2, '0');
  return `${alarmId}:${y}-${m}-${d}T${hh}:${mm}:00`;
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
  } catch {
    // ignore
  }
  return null;
}

// In-memory cache for fast lookup during high-frequency checks
const handledOccurrencesMemory = new Set<string>();

/**
 * Loads handled occurrence IDs from storage and populates in-memory cache
 */
export function loadHandledOccurrences(): Set<string> {
  try {
    const storage = getLocalStorage();
    if (!storage) return handledOccurrencesMemory;

    const raw = storage.getItem(STORAGE_KEY_HANDLED_OCCURRENCES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const id of parsed) {
          if (typeof id === 'string') {
            handledOccurrencesMemory.add(id);
          }
        }
      }
    }
  } catch (err) {
    recordAppError({
      operation: 'alarm_handled_store_read',
      title: 'Handled occurrences read error',
      message: 'Could not parse handled alarm history from storage.',
      severity: 'warning',
      technicalDetails: err instanceof Error ? err.message : String(err),
    });
  }
  return handledOccurrencesMemory;
}

/**
 * Checks whether an occurrence has already been executed or triggered
 */
export function isOccurrenceHandled(occurrenceId: string): boolean {
  if (handledOccurrencesMemory.has(occurrenceId)) {
    return true;
  }
  loadHandledOccurrences();
  return handledOccurrencesMemory.has(occurrenceId);
}

/**
 * Marks an occurrence as handled and persists the updated registry
 */
export function markOccurrenceHandled(occurrenceId: string): void {
  handledOccurrencesMemory.add(occurrenceId);
  try {
    const storage = getLocalStorage();
    if (!storage) return;

    // Keep bounded history (last 100 occurrences)
    const list = Array.from(handledOccurrencesMemory).slice(-100);
    storage.setItem(STORAGE_KEY_HANDLED_OCCURRENCES, JSON.stringify(list));
  } catch (err) {
    recordAppError({
      operation: 'alarm_handled_store_write',
      title: 'Failed to record handled alarm',
      message: 'Could not persist handled alarm occurrence identifier.',
      severity: 'warning',
      technicalDetails: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Clears handled occurrences cache (primarily used in test suites)
 */
export function resetHandledOccurrences(): void {
  handledOccurrencesMemory.clear();
  try {
    const storage = getLocalStorage();
    storage?.removeItem(STORAGE_KEY_HANDLED_OCCURRENCES);
  } catch {
    // ignore
  }
}

// ============================================================================
// 2. ACTIVE SESSION PERSISTENCE & RECOVERY
// ============================================================================

/**
 * Loads the active alarm session from persistent storage
 */
export function loadActiveSession(): AlarmSession | null {
  try {
    const storage = getLocalStorage();
    if (!storage) return null;

    const raw = storage.getItem(STORAGE_KEY_ACTIVE_SESSION);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.sessionId) {
      return null;
    }

    const session = parsed as AlarmSession;

    // If session is already completed or stopped, discard from active storage
    if (session.status === 'completed' || session.status === 'stopped') {
      storage.removeItem(STORAGE_KEY_ACTIVE_SESSION);
      return null;
    }

    // If ringing but triggered more than 30 minutes ago, treat as stale/expired
    if (session.status === 'ringing') {
      const triggeredTime = new Date(session.triggeredAt).getTime();
      const now = getAlarmCurrentTime().getTime();
      if (now - triggeredTime > 30 * 60 * 1000) {
        session.status = 'completed';
        session.completedAt = new Date().toISOString();
        storage.removeItem(STORAGE_KEY_ACTIVE_SESSION);
        return null;
      }
    }

    return session;
  } catch (err) {
    recordAppError({
      operation: 'alarm_session_recovery',
      title: 'Active alarm session recovery error',
      message: 'Failed to deserialize active alarm session from storage.',
      severity: 'warning',
      technicalDetails: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Persists or clears active alarm session
 */
export function saveActiveSession(session: AlarmSession | null): void {
  try {
    const storage = getLocalStorage();
    if (!storage) return;

    if (!session || session.status === 'completed' || session.status === 'stopped') {
      storage.removeItem(STORAGE_KEY_ACTIVE_SESSION);
    } else {
      storage.setItem(STORAGE_KEY_ACTIVE_SESSION, JSON.stringify(session));
    }
  } catch (err) {
    recordAppError({
      operation: 'alarm_session_save',
      title: 'Active alarm session save error',
      message: 'Failed to write active alarm session to storage.',
      severity: 'critical',
      technicalDetails: err instanceof Error ? err.message : String(err),
    });
  }
}

// ============================================================================
// 3. AUDIO RESOLUTION FOR ALARM TRIGGER
// ============================================================================

const STORAGE_KEY_SONGS = 'mission_media_songs_v2';

/**
 * Resolves the exact daily track for the alarm through the audio vault
 * Strictly adheres to Invariants:
 * 1. Uses the day's exact selected track via getDailyTrackId().
 * 2. Never invents placeholder tracks or selects unrelated songs.
 * 3. In case of missing track or empty vault, records error and uses defined fallback.
 */
export async function resolveAlarmAudio(customTrackId?: string | null): Promise<AudioResolutionResult> {
  const targetTrackId = customTrackId !== undefined ? customTrackId : getDailyTrackId();

  // Case 1: Audio library is empty or no track selected
  if (!targetTrackId) {
    recordAppError({
      operation: 'alarm_audio_resolution',
      title: 'No daily track available for alarm',
      message: 'Audio library is empty or no track has been selected for today. Alarm will proceed with built-in standby chime.',
      severity: 'warning',
      technicalDetails: 'dailyTrackId is null; audio library contains 0 tracks.',
    });

    return {
      trackId: null,
      title: 'Standby Wake Chime',
      blob: null,
      isFallback: true,
      reason: 'empty_library',
    };
  }

  // Case 2: Resolve metadata from stored songs list
  let songMetadata: { id: string; title: string; src?: string } | null = null;
  try {
    const storage = getLocalStorage();
    const rawSongs = storage?.getItem(STORAGE_KEY_SONGS);
    if (rawSongs) {
      const parsed = JSON.parse(rawSongs);
      if (Array.isArray(parsed)) {
        songMetadata = parsed.find((s) => s && s.id === targetTrackId) || null;
      }
    }
  } catch {
    // ignore
  }

  if (!songMetadata) {
    recordAppError({
      operation: 'alarm_audio_resolution',
      title: 'Selected daily track missing from vault',
      message: `Track ID "${targetTrackId}" could not be resolved from songs archive. Using fallback chime.`,
      severity: 'warning',
      technicalDetails: `dailyTrackId: ${targetTrackId}`,
    });

    return {
      trackId: targetTrackId,
      title: 'Standby Wake Chime',
      blob: null,
      isFallback: true,
      reason: 'metadata_missing',
    };
  }

  // Case 3: Resolve binary Blob from IndexedDB vault
  try {
    const blob = await getAudioFromVault(targetTrackId);
    if (blob && blob.size > 0) {
      return {
        trackId: songMetadata.id,
        title: songMetadata.title,
        blob,
        isFallback: false,
      };
    }

    // If blob is missing but valid object URL exists (e.g. demo track in active session)
    if (songMetadata.src && songMetadata.src.startsWith('blob:')) {
      return {
        trackId: songMetadata.id,
        title: songMetadata.title,
        blob: null,
        url: songMetadata.src,
        isFallback: false,
      };
    }

    recordAppError({
      operation: 'alarm_audio_resolution',
      title: 'Track binary data missing from vault',
      message: `Binary audio blob for "${songMetadata.title}" is missing from IndexedDB. Using fallback chime.`,
      severity: 'warning',
      technicalDetails: `Track ID: ${targetTrackId}`,
    });

    return {
      trackId: songMetadata.id,
      title: songMetadata.title,
      blob: null,
      isFallback: true,
      reason: 'blob_missing',
    };
  } catch (err) {
    recordAppError({
      operation: 'alarm_audio_resolution',
      title: 'Vault retrieval error',
      message: 'Failed to access IndexedDB audio store during alarm preparation.',
      severity: 'warning',
      technicalDetails: err instanceof Error ? err.message : String(err),
    });

    return {
      trackId: songMetadata.id,
      title: songMetadata.title,
      blob: null,
      isFallback: true,
      reason: 'vault_error',
    };
  }
}

// ============================================================================
// 4. IDENTIFYING DUE ALARMS
// ============================================================================

/**
 * Scans enabled alarms to find occurrences that are currently due
 * within the tolerance window based on local wall-clock time.
 */
export function findDueAlarmOccurrences(
  alarms: AlarmItem[],
  referenceDate?: Date,
  toleranceWindowMs = DEFAULT_DUE_TOLERANCE_MS
): DueAlarmMatch[] {
  const ref = referenceDate ? new Date(referenceDate) : getAlarmCurrentTime();
  if (isNaN(ref.getTime())) return [];

  const dueMatches: DueAlarmMatch[] = [];
  const refTime = ref.getTime();
  const refDayOfWeek = ref.getDay();

  for (const alarm of alarms) {
    if (!alarm.enabled) continue;

    // Schedule check for today
    const isRepeating = alarm.repeatDays.length > 0;
    if (isRepeating && !alarm.repeatDays.includes(refDayOfWeek)) {
      continue;
    }

    // Construct scheduled trigger time for today
    const scheduledDate = new Date(
      ref.getFullYear(),
      ref.getMonth(),
      ref.getDate(),
      alarm.hour,
      alarm.minute,
      0,
      0
    );

    const diffMs = refTime - scheduledDate.getTime();

    // Check if alarm time was reached within the past tolerance window
    // (diffMs >= 0 means scheduled time has arrived or just passed)
    if (diffMs >= 0 && diffMs <= toleranceWindowMs) {
      const occurrenceId = generateOccurrenceId(alarm.id, scheduledDate);

      // Verify this exact occurrence has not already been handled
      if (!isOccurrenceHandled(occurrenceId)) {
        dueMatches.push({
          alarm,
          occurrenceDate: scheduledDate,
          occurrenceId,
          diffMs,
        });
      }
    }
  }

  // Sort by earliest scheduled time, then earlier createdAt
  dueMatches.sort((a, b) => {
    const timeDiff = a.occurrenceDate.getTime() - b.occurrenceDate.getTime();
    if (timeDiff !== 0) return timeDiff;
    return (a.alarm.createdAt || '').localeCompare(b.alarm.createdAt || '');
  });

  return dueMatches;
}

// ============================================================================
// 5. ALARM EXECUTION COORDINATOR CLASS
// ============================================================================

export class AlarmExecutionCoordinator {
  private activeSession: AlarmSession | null = null;
  private listeners = new Set<AlarmSessionListener>();
  private activeCheckPromise: Promise<AlarmSession | null> | null = null;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private snoozeDurationMinutes = DEFAULT_SNOOZE_DURATION_MINUTES;
  private toleranceWindowMs = DEFAULT_DUE_TOLERANCE_MS;

  constructor(options?: {
    snoozeDurationMinutes?: number;
    toleranceWindowMs?: number;
  }) {
    if (options?.snoozeDurationMinutes) {
      this.snoozeDurationMinutes = options.snoozeDurationMinutes;
    }
    if (options?.toleranceWindowMs) {
      this.toleranceWindowMs = options.toleranceWindowMs;
    }
    // Restore active session on initialization
    this.activeSession = loadActiveSession();
  }

  /**
   * Subscribes a listener to session state transitions
   */
  public subscribe(listener: AlarmSessionListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current state
    listener(this.activeSession);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    saveActiveSession(this.activeSession);
    for (const listener of this.listeners) {
      try {
        listener(this.activeSession);
      } catch {
        // ignore listener errors
      }
    }
  }

  /**
   * Returns current active alarm session
   */
  public getActiveSession(): AlarmSession | null {
    return this.activeSession;
  }

  /**
   * Evaluates due alarms and active snoozed sessions.
   * Guarded against concurrent re-entry with shared in-flight promise.
   */
  public async checkDueAlarms(
    referenceDate?: Date,
    injectedAlarms?: AlarmItem[]
  ): Promise<AlarmSession | null> {
    if (this.activeCheckPromise) {
      return this.activeCheckPromise;
    }

    const promise = this.executeCheckDueAlarms(referenceDate, injectedAlarms);
    this.activeCheckPromise = promise;

    try {
      return await promise;
    } finally {
      this.activeCheckPromise = null;
    }
  }

  private async executeCheckDueAlarms(
    referenceDate?: Date,
    injectedAlarms?: AlarmItem[]
  ): Promise<AlarmSession | null> {
    const now = referenceDate ? new Date(referenceDate) : getAlarmCurrentTime();

    // 1. Check if an existing snoozed session is due to ring again
    if (this.activeSession && this.activeSession.status === 'snoozed') {
      if (this.activeSession.snoozeUntil) {
        const snoozeExpiry = new Date(this.activeSession.snoozeUntil).getTime();
        if (now.getTime() >= snoozeExpiry) {
          // Transition from snoozed -> ringing
          this.activeSession.status = 'ringing';
          this.activeSession.snoozeUntil = null;
          this.activeSession.triggeredAt = now.toISOString();
          this.notifyListeners();
          return this.activeSession;
        }
      }
      return this.activeSession;
    }

    // 2. If an alarm is already ringing, prevent duplicate concurrent ringing
    if (this.activeSession && this.activeSession.status === 'ringing') {
      return this.activeSession;
    }

    // 3. Scan for new due alarms
    const alarms = injectedAlarms || loadStoredAlarms();
    const dueMatches = findDueAlarmOccurrences(alarms, now, this.toleranceWindowMs);

    if (dueMatches.length > 0) {
      const topMatch = dueMatches[0];
      const newSession = await this.triggerSession(topMatch.alarm, topMatch.occurrenceDate, topMatch.occurrenceId);
      return newSession;
    }

    return this.activeSession;
  }

  /**
   * Triggers an alarm occurrence and transitions to 'ringing'
   */
  public async triggerSession(
    alarm: AlarmItem,
    occurrenceDate: Date,
    occurrenceId?: string
  ): Promise<AlarmSession> {
    const now = getAlarmCurrentTime();
    const occId = occurrenceId || generateOccurrenceId(alarm.id, occurrenceDate);

    // CRITICAL: Mark occurrence handled immediately to prevent race conditions
    markOccurrenceHandled(occId);

    // Resolve audio
    const audioRes = await resolveAlarmAudio();

    const sessionId = `session_${now.getTime()}_${Math.random().toString(36).substring(2, 7)}`;

    this.activeSession = {
      sessionId,
      alarmId: alarm.id,
      alarmLabel: alarm.label || 'Alarm',
      occurrenceId: occId,
      scheduledTime: occurrenceDate.toISOString(),
      triggeredAt: now.toISOString(),
      status: 'ringing',
      snoozeCount: 0,
      snoozeDurationMinutes: this.snoozeDurationMinutes,
      snoozeUntil: null,
      stoppedAt: null,
      completedAt: null,
      resolvedTrackId: audioRes.trackId,
      trackTitle: audioRes.title,
      hasAudio: Boolean(audioRes.blob || audioRes.url),
      audioFallbackUsed: audioRes.isFallback,
    };

    // If one-time alarm, handle disarm lifecycle safely
    if (alarm.repeatDays.length === 0) {
      handleAlarmFired(alarm.id);
    }

    this.notifyListeners();
    return this.activeSession;
  }

  /**
   * Snoozes the active ringing session.
   * Idempotent: repeated calls while already snoozed return the existing session.
   */
  public snooze(snoozeMinutes?: number): AlarmSession | null {
    if (!this.activeSession) {
      return null;
    }

    // Idempotency: If already snoozed, return existing session without resetting snooze timer
    if (this.activeSession.status === 'snoozed') {
      return this.activeSession;
    }

    // Can only snooze from 'ringing'
    if (this.activeSession.status !== 'ringing') {
      return this.activeSession;
    }

    const duration = snoozeMinutes && snoozeMinutes > 0 ? snoozeMinutes : this.snoozeDurationMinutes;
    const now = getAlarmCurrentTime();
    const snoozeUntilDate = new Date(now.getTime() + duration * 60 * 1000);

    this.activeSession.status = 'snoozed';
    this.activeSession.snoozeCount += 1;
    this.activeSession.snoozeUntil = snoozeUntilDate.toISOString();

    this.notifyListeners();
    return this.activeSession;
  }

  /**
   * Stops the active ringing or snoozed session.
   * Idempotent: repeated calls do nothing and return the stopped session.
   */
  public stop(): AlarmSession | null {
    if (!this.activeSession) {
      return null;
    }

    // Idempotency: If already stopped or completed, return session as is
    if (this.activeSession.status === 'stopped' || this.activeSession.status === 'completed') {
      return this.activeSession;
    }

    const now = getAlarmCurrentTime();
    const stoppedSession: AlarmSession = {
      ...this.activeSession,
      status: 'stopped',
      stoppedAt: now.toISOString(),
      completedAt: now.toISOString(),
      snoozeUntil: null,
    };

    // Ensure one-time alarm is disarmed
    const stored = loadStoredAlarms();
    const match = stored.find((a) => a.id === stoppedSession.alarmId);
    if (match && match.repeatDays.length === 0 && match.enabled) {
      handleAlarmFired(match.id, stored);
    }

    this.activeSession = stoppedSession;
    this.notifyListeners();

    // Mark completed and clear active session
    this.activeSession = null;
    saveActiveSession(null);
    for (const listener of this.listeners) {
      try {
        listener(null);
      } catch {
        // ignore
      }
    }

    return stoppedSession;
  }

  /**
   * Starts periodic polling coordinator for the application session.
   * Note: This handles in-app execution while open; background adapters will use native hooks.
   */
  public start(pollIntervalMs = 1000): void {
    if (this.checkTimer) return;
    this.checkDueAlarms();
    this.checkTimer = setInterval(() => {
      this.checkDueAlarms();
    }, pollIntervalMs);
  }

  /**
   * Stops periodic polling
   */
  public stopCoordinator(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Resets coordinator state (primarily for test isolation)
   */
  public reset(): void {
    this.stopCoordinator();
    this.activeSession = null;
    saveActiveSession(null);
    this.notifyListeners();
  }
}

// Global coordinator singleton for application lifecycle
export const defaultAlarmCoordinator = new AlarmExecutionCoordinator();

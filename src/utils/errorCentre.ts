/**
 * MISSION Error Centre & Notification System
 * 
 * Reusable error logging, deduplication, and user-facing plain-language recovery engine.
 * Never swallows errors silently and prevents notification spam.
 */

export type ErrorSeverity = 'critical' | 'warning' | 'info';

export interface AppErrorEntry {
  id: string;
  timestamp: string;
  operation: string;
  title: string;
  message: string;
  severity: ErrorSeverity;
  technicalDetails?: string;
  recoveryLabel?: string;
  recoveryActionType?: string;
  simulated?: boolean;
}

export type ErrorToastListener = (entry: AppErrorEntry) => void;

const STORAGE_KEY_ERRORS = 'mission_error_centre_v1';
const listeners = new Set<ErrorToastListener>();
const recentErrorsMap = new Map<string, number>();

export function recordAppError(params: {
  operation: string;
  title: string;
  message: string;
  severity?: ErrorSeverity;
  technicalDetails?: string;
  recoveryLabel?: string;
  recoveryActionType?: string;
  simulated?: boolean;
}): AppErrorEntry {
  const entry: AppErrorEntry = {
    id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    operation: params.operation,
    title: params.title,
    message: params.message,
    severity: params.severity || 'warning',
    technicalDetails: params.technicalDetails,
    recoveryLabel: params.recoveryLabel,
    recoveryActionType: params.recoveryActionType,
    simulated: Boolean(params.simulated),
  };

  // Anti-spam deduplication check: suppress identical messages within 4 seconds
  const dedupeKey = `${entry.operation}:${entry.title}:${entry.message}`;
  const now = Date.now();
  const lastTime = recentErrorsMap.get(dedupeKey) || 0;
  recentErrorsMap.set(dedupeKey, now);

  const isSpam = now - lastTime < 4000 && lastTime !== 0;

  // Persist entry to bounded log (max 40)
  try {
    const existingStr = localStorage.getItem(STORAGE_KEY_ERRORS);
    const existing: AppErrorEntry[] = existingStr ? JSON.parse(existingStr) : [];
    const next = [entry, ...existing.slice(0, 39)];
    localStorage.setItem(STORAGE_KEY_ERRORS, JSON.stringify(next));
  } catch {
    // ignore storage quota
  }

  // Dispatch toast notification to active listeners if not duplicate spam
  if (!isSpam) {
    listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch (err) {
        console.error('Error toast listener failed:', err);
      }
    });
  }

  return entry;
}

export function getErrorLogs(): AppErrorEntry[] {
  try {
    const existingStr = localStorage.getItem(STORAGE_KEY_ERRORS);
    if (existingStr) {
      const parsed = JSON.parse(existingStr);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function clearErrorLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_ERRORS);
  } catch {
    // ignore
  }
}

export function subscribeErrorToast(listener: ErrorToastListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * MISSION Local Event Timeline Engine
 * 
 * Records high-fidelity chronological audits of key system operations:
 * Media imports, deletions, settings mutations, diagnostic executions, and sandbox switches.
 * Bounded to 80 entries to prevent unbounded storage expansion.
 */

export type TimelineEventType =
  | 'media_import'
  | 'media_delete'
  | 'settings_change'
  | 'diagnostic_run'
  | 'recovery'
  | 'daily_track'
  | 'sandbox';

export type TimelineSeverity = 'info' | 'success' | 'warning' | 'error';

export interface TimelineEntry {
  id: string;
  timestamp: string;
  type: TimelineEventType;
  severity: TimelineSeverity;
  title: string;
  message: string;
}

const STORAGE_KEY_TIMELINE = 'mission_event_timeline_v1';
const MAX_TIMELINE_ENTRIES = 80;

export function recordTimelineEvent(params: {
  type: TimelineEventType;
  severity?: TimelineSeverity;
  title: string;
  message: string;
}): TimelineEntry {
  const entry: TimelineEntry = {
    id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    type: params.type,
    severity: params.severity || 'info',
    title: params.title,
    message: params.message,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY_TIMELINE);
    const existing: TimelineEntry[] = raw ? JSON.parse(raw) : [];
    const updated = [entry, ...existing.slice(0, MAX_TIMELINE_ENTRIES - 1)];
    localStorage.setItem(STORAGE_KEY_TIMELINE, JSON.stringify(updated));
  } catch {
    // ignore quota
  }

  return entry;
}

export function getTimelineEvents(): TimelineEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TIMELINE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function clearTimelineEvents(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_TIMELINE);
  } catch {
    // ignore
  }
}

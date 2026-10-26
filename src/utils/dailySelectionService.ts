/**
 * MISSION Daily Selection Service
 * 
 * Centralized deterministic daily selector connecting persistent Image Gallery
 * and Phonk Audio Vault to Home and the future Alarm Engine.
 * 
 * Invariants:
 * 1. Deterministic for the same calendar date (persisted in localStorage).
 * 2. Independent empty states: null if library is empty, never fabricates demo content.
 * 3. Reactive to deletions: picks a replacement if current item was deleted.
 * 4. Stable on additions: adding media does not alter the current day's selection.
 * 5. Non-consecutive repeat avoidance when library has >= 2 items.
 * 6. Clean interface for Alarm Engine: getDailyTrackId().
 */

import { TrackItem, ImageItem } from '../types/media';
import { recordAppError } from './errorCentre';

export const STORAGE_KEY_DAILY_SELECTION = 'mission_daily_selection_v1';

export interface PersistedDailySelection {
  date: string; // YYYY-MM-DD
  selectedTrackId: string | null;
  selectedImageId: string | null;
  previousTrackId?: string | null;
  previousImageId?: string | null;
  updatedAt: number;
}

export interface DailySelectionResult {
  date: string;
  selectedTrackId: string | null;
  selectedImageId: string | null;
  track: TrackItem | null;
  image: ImageItem | null;
  isNewSelection: boolean;
}

// Injectable clock provider for testing and date management
let clockOverride: (() => Date) | null = null;

export function setClockOverride(fn: (() => Date) | null): void {
  clockOverride = fn;
}

export function getNow(): Date {
  return clockOverride ? clockOverride() : new Date();
}

/**
 * Formats a Date object into local calendar YYYY-MM-DD string.
 */
export function getLocalCalendarDate(date: Date = getNow()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStorage(): Storage | null {
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

/**
 * Reads the stored daily selection from localStorage.
 */
export function getStoredDailySelection(): PersistedDailySelection | null {
  try {
    const storage = getStorage();
    if (!storage) return null;
    const raw = storage.getItem(STORAGE_KEY_DAILY_SELECTION);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.date === 'string') {
      return parsed as PersistedDailySelection;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Saves daily selection to localStorage safely.
 */
export function saveStoredDailySelection(selection: PersistedDailySelection): void {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.setItem(STORAGE_KEY_DAILY_SELECTION, JSON.stringify(selection));
  } catch (err) {
    recordAppError({
      operation: 'Daily Selection',
      title: 'PERSISTENCE WARNING',
      message: 'Could not write daily selection to storage.',
      technicalDetails: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Pick a random item from a list, avoiding previousId if at least 2 items exist.
 */
function pickRandomItem<T extends { id: string }>(
  items: T[],
  previousId?: string | null
): T | null {
  if (!items || items.length === 0) return null;
  if (items.length === 1) return items[0];

  let pool = items;
  if (previousId) {
    const filtered = items.filter((item) => item.id !== previousId);
    if (filtered.length > 0) {
      pool = filtered;
    }
  }

  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

// In-flight mutex to prevent concurrent initialization race conditions
let activeSyncPromise: Promise<DailySelectionResult> | null = null;

async function executeResolveDailySelection(
  songs: TrackItem[],
  images: ImageItem[],
  customDate?: Date
): Promise<DailySelectionResult> {
  const targetDate = getLocalCalendarDate(customDate || getNow());
  const stored = getStoredDailySelection();

  let selectedTrackId: string | null = null;
  let selectedImageId: string | null = null;
  let previousTrackId: string | null = null;
  let previousImageId: string | null = null;
  let isNewSelection = false;

  const isSameDate = stored !== null && stored.date === targetDate;

  if (isSameDate && stored) {
    // Same calendar day: preserve previous day history
    previousTrackId = stored.previousTrackId || null;
    previousImageId = stored.previousImageId || null;

    // 1. Verify track reference
    if (stored.selectedTrackId && songs.some((s) => s.id === stored.selectedTrackId)) {
      selectedTrackId = stored.selectedTrackId;
    } else {
      // Track deleted or invalid: pick a valid replacement from remaining
      const replacement = pickRandomItem(songs, previousTrackId);
      selectedTrackId = replacement ? replacement.id : null;
    }

    // 2. Verify image reference
    if (stored.selectedImageId && images.some((i) => i.id === stored.selectedImageId)) {
      selectedImageId = stored.selectedImageId;
    } else {
      // Image deleted or invalid: pick a valid replacement from remaining
      const replacement = pickRandomItem(images, previousImageId);
      selectedImageId = replacement ? replacement.id : null;
    }

    // If something changed due to deletions, persist the update
    if (
      selectedTrackId !== stored.selectedTrackId ||
      selectedImageId !== stored.selectedImageId
    ) {
      saveStoredDailySelection({
        date: targetDate,
        selectedTrackId,
        selectedImageId,
        previousTrackId,
        previousImageId,
        updatedAt: Date.now(),
      });
    }
  } else {
    // Date changed or first run: roll over previous day
    isNewSelection = true;
    previousTrackId = stored ? stored.selectedTrackId : null;
    previousImageId = stored ? stored.selectedImageId : null;

    const newTrack = pickRandomItem(songs, previousTrackId);
    const newImage = pickRandomItem(images, previousImageId);

    selectedTrackId = newTrack ? newTrack.id : null;
    selectedImageId = newImage ? newImage.id : null;

    saveStoredDailySelection({
      date: targetDate,
      selectedTrackId,
      selectedImageId,
      previousTrackId,
      previousImageId,
      updatedAt: Date.now(),
    });
  }

  const track = selectedTrackId ? songs.find((s) => s.id === selectedTrackId) || null : null;
  const image = selectedImageId ? images.find((i) => i.id === selectedImageId) || null : null;

  return {
    date: targetDate,
    selectedTrackId,
    selectedImageId,
    track,
    image,
    isNewSelection,
  };
}

/**
 * Resolves the daily track and image selection based on current persistent media.
 * Uses mutex to share in-flight promises across concurrent callers.
 */
export async function resolveDailySelection(
  songs: TrackItem[],
  images: ImageItem[],
  customDate?: Date
): Promise<DailySelectionResult> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  const promise = executeResolveDailySelection(songs, images, customDate);
  activeSyncPromise = promise;

  try {
    return await promise;
  } finally {
    activeSyncPromise = null;
  }
}

/**
 * Public service interface for Alarm Engine:
 * Returns the currently persisted daily track ID.
 */
export function getDailyTrackId(): string | null {
  const current = getStoredDailySelection();
  return current?.selectedTrackId || null;
}

/**
 * Public service interface for Alarm Engine & Diagnostics:
 * Returns the currently persisted daily image ID.
 */
export function getDailyImageId(): string | null {
  const current = getStoredDailySelection();
  return current?.selectedImageId || null;
}

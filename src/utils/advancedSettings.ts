/**
 * MISSION Advanced Settings, Preferences & Backup Manager
 * 
 * Manages persistent preferences, safe mode, and versioned JSON backup export/validation.
 */

export interface AdvancedPreferences {
  reducedMotion: 'system' | 'always' | 'never';
  visualQuality: 'high' | 'medium' | 'safe';
  hapticsEnabled: boolean;
  diagnosticVerbosity: 'minimal' | 'standard' | 'verbose';
  autoCleanup: boolean;
  diagnosticLogging: boolean;
  safeMode: boolean;
}

export const DEFAULT_PREFERENCES: AdvancedPreferences = {
  reducedMotion: 'system',
  visualQuality: 'high',
  hapticsEnabled: true,
  diagnosticVerbosity: 'standard',
  autoCleanup: true,
  diagnosticLogging: true,
  safeMode: false,
};

const STORAGE_KEY_PREFS = 'mission_advanced_preferences_v1';

export function loadAdvancedPreferences(): AdvancedPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
  } catch {
    // fallback
  }
  return DEFAULT_PREFERENCES;
}

export function saveAdvancedPreferences(prefs: AdvancedPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export interface SettingsBackupPackage {
  schemaVersion: string;
  appIdentifier: string;
  exportTimestamp: string;
  preferences: AdvancedPreferences;
  alarmsSnapshot?: unknown[];
  metadataSummary: {
    audioCount: number;
    imageCount: number;
  };
}

export function createSettingsBackupPackage(options: {
  preferences: AdvancedPreferences;
  audioCount: number;
  imageCount: number;
}): SettingsBackupPackage {
  let alarmsSnapshot: unknown[] = [];
  try {
    const rawAlarms = localStorage.getItem('mission_alarms_v2');
    if (rawAlarms) alarmsSnapshot = JSON.parse(rawAlarms);
  } catch {
    // ignore
  }

  return {
    schemaVersion: '1.0.0',
    appIdentifier: 'MISSION_BUILD_ARCHIVE',
    exportTimestamp: new Date().toISOString(),
    preferences: options.preferences,
    alarmsSnapshot,
    metadataSummary: {
      audioCount: options.audioCount,
      imageCount: options.imageCount,
    },
  };
}

export function downloadSettingsBackup(pkg: SettingsBackupPackage): void {
  const jsonString = JSON.stringify(pkg, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `mission-settings-backup-${Date.now()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function validateBackupJson(rawText: string): {
  valid: boolean;
  package?: SettingsBackupPackage;
  error?: string;
} {
  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'File content is not a valid JSON object.' };
    }

    if (!parsed.schemaVersion || typeof parsed.schemaVersion !== 'string') {
      return { valid: false, error: 'Missing or invalid schemaVersion in backup package.' };
    }

    if (!parsed.preferences || typeof parsed.preferences !== 'object') {
      return { valid: false, error: 'Backup is missing valid preferences data.' };
    }

    return {
      valid: true,
      package: parsed as SettingsBackupPackage,
    };
  } catch (err) {
    return {
      valid: false,
      error: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

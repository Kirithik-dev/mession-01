/**
 * MISSION Image Storage Vault
 * 
 * Persistent image binary and metadata storage using native IndexedDB (mission_image_vault_db).
 * Stores raw Blobs and metadata across full page refreshes, tab closures, and app restarts.
 * Provides object URL lifecycle tracking, quota error dispatching, and duplicate prevention.
 */

import { recordAppError } from './errorCentre';

export const IMAGE_DB_NAME = 'mission_image_vault_db';
export const IMAGE_STORE_NAME = 'image_records';
export const IMAGE_DB_VERSION = 1;

export interface StoredImageRecord {
  id: string;
  title: string;
  blob: Blob;
  fileName: string;
  fileSize: number;
  mimeType: string;
  addedAt: number;
  aspectRatio?: number;
  isDemo?: boolean;
}

// Managed active object URLs (recordId -> URL)
const activeObjectUrls = new Map<string, string>();

/**
 * Returns an existing active object URL for the given record ID or creates a fresh one.
 * Prevents memory thrashing while guaranteeing a valid URL during the session.
 */
export function getOrRegisterImageUrl(id: string, blob: Blob): string {
  const existing = activeObjectUrls.get(id);
  if (existing) {
    return existing;
  }
  const freshUrl = URL.createObjectURL(blob);
  activeObjectUrls.set(id, freshUrl);
  return freshUrl;
}

/**
 * Revokes the object URL associated with an ID when removed from the library.
 */
export function revokeImageUrl(id: string): void {
  const url = activeObjectUrls.get(id);
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
    activeObjectUrls.delete(id);
  }
}

/**
 * Revokes multiple object URLs.
 */
export function revokeImageUrls(ids: string[]): void {
  ids.forEach(revokeImageUrl);
}

/**
 * Revokes all managed object URLs (e.g., when the entire image library is cleared).
 */
export function revokeAllImageUrls(): void {
  activeObjectUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  });
  activeObjectUrls.clear();
}

/**
 * Opens or upgrades the image vault IndexedDB instance.
 */
export function openImageVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      const err = new Error('IndexedDB is not supported in this browser environment.');
      recordAppError({
        operation: 'Image Storage',
        title: 'INDEXEDDB UNAVAILABLE',
        message: 'Persistent image caching requires IndexedDB, which is unavailable or disabled.',
        severity: 'critical',
        technicalDetails: err.message,
      });
      return reject(err);
    }

    const req = indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        const store = db.createObjectStore(IMAGE_STORE_NAME, { keyPath: 'id' });
        store.createIndex('addedAt', 'addedAt', { unique: false });
        store.createIndex('fileName', 'fileName', { unique: false });
      }
    };

    req.onblocked = () => {
      recordAppError({
        operation: 'Image Storage',
        title: 'STORAGE UPGRADE BLOCKED',
        message: 'Database upgrade is blocked by another open tab. Please close other MISSION tabs.',
        severity: 'warning',
      });
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };

    req.onerror = () => {
      const errorMsg = req.error ? req.error.message : 'Unknown IndexedDB connection error';
      recordAppError({
        operation: 'Image Storage',
        title: 'DATABASE CONNECTION FAILED',
        message: `Failed to open image storage vault: ${errorMsg}`,
        severity: 'critical',
        technicalDetails: errorMsg,
      });
      reject(req.error || new Error(errorMsg));
    };
  });
}

/**
 * Persists a single image record into the IndexedDB vault.
 */
export async function saveImageRecord(record: StoredImageRecord): Promise<void> {
  const db = await openImageVaultDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IMAGE_STORE_NAME);
      const putReq = store.put(record);

      putReq.onerror = () => {
        const err = putReq.error;
        if (err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
          recordAppError({
            operation: 'Image Storage',
            title: 'STORAGE QUOTA EXCEEDED',
            message: `Not enough storage available to save image "${record.title}". Please free up device storage.`,
            severity: 'critical',
            technicalDetails: err.message,
          });
        } else {
          recordAppError({
            operation: 'Image Storage',
            title: 'IMAGE PERSISTENCE FAILED',
            message: `Could not write image "${record.title}" to storage vault.`,
            severity: 'warning',
            technicalDetails: err?.message,
          });
        }
        reject(err || new Error('Put record failed'));
      };

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        const err = tx.error;
        if (err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
          recordAppError({
            operation: 'Image Storage',
            title: 'STORAGE QUOTA EXCEEDED',
            message: 'Device storage limit reached while persisting image data.',
            severity: 'critical',
          });
        }
        reject(err || new Error('Transaction aborted'));
      };
    } catch (err) {
      recordAppError({
        operation: 'Image Storage',
        title: 'TRANSACTION INITIALIZATION FAILED',
        message: err instanceof Error ? err.message : String(err),
        severity: 'critical',
      });
      reject(err);
    }
  });
}

/**
 * Persists multiple image records in a single transactional batch.
 */
export async function saveImageRecords(records: StoredImageRecord[]): Promise<void> {
  if (records.length === 0) return;
  const db = await openImageVaultDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IMAGE_STORE_NAME);

      records.forEach((record) => {
        store.put(record);
      });

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        const err = tx.error;
        if (err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
          recordAppError({
            operation: 'Image Storage',
            title: 'STORAGE QUOTA EXCEEDED',
            message: 'Device storage limit reached while saving batch of images.',
            severity: 'critical',
          });
        } else {
          recordAppError({
            operation: 'Image Storage',
            title: 'BATCH SAVE FAILED',
            message: `Failed to persist batch of ${records.length} images into vault.`,
            severity: 'warning',
            technicalDetails: err?.message,
          });
        }
        reject(err || new Error('Batch transaction aborted'));
      };
    } catch (err) {
      recordAppError({
        operation: 'Image Storage',
        title: 'BATCH TRANSACTION INITIALIZATION FAILED',
        message: err instanceof Error ? err.message : String(err),
        severity: 'critical',
      });
      reject(err);
    }
  });
}

/**
 * Retrieves a single image record by ID.
 */
export async function getImageRecord(id: string): Promise<StoredImageRecord | null> {
  try {
    const db = await openImageVaultDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IMAGE_STORE_NAME, 'readonly');
      const req = tx.objectStore(IMAGE_STORE_NAME).get(id);
      req.onsuccess = () => resolve((req.result as StoredImageRecord) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Retrieves all stored image records, sorted by addedAt descending (newest first).
 */
export async function getAllImageRecords(): Promise<StoredImageRecord[]> {
  try {
    const db = await openImageVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IMAGE_STORE_NAME, 'readonly');
      const store = tx.objectStore(IMAGE_STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = (req.result as StoredImageRecord[]) || [];
        records.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
        resolve(records);
      };

      req.onerror = () => {
        recordAppError({
          operation: 'Image Storage',
          title: 'IMAGE RETRIEVAL FAILED',
          message: 'Could not read stored image records from IndexedDB.',
          severity: 'warning',
        });
        reject(req.error || new Error('getAll failed'));
      };
    });
  } catch {
    return [];
  }
}

/**
 * Deletes a single image record by ID. Throws on error so UI deletion is guarded.
 */
export async function deleteImageRecord(id: string): Promise<void> {
  const db = await openImageVaultDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
      tx.objectStore(IMAGE_STORE_NAME).delete(id);

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        const err = tx.error;
        recordAppError({
          operation: 'Image Deletion',
          title: 'DELETION FAILED',
          message: `Failed to remove image record ${id} from storage vault.`,
          severity: 'warning',
          technicalDetails: err?.message,
        });
        reject(err || new Error('Delete transaction aborted'));
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Deletes multiple image records in a single transaction. Throws on error so UI deletion is guarded.
 */
export async function deleteImageRecords(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openImageVaultDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IMAGE_STORE_NAME);

      ids.forEach((id) => {
        store.delete(id);
      });

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        const err = tx.error;
        recordAppError({
          operation: 'Image Deletion',
          title: 'BATCH DELETION FAILED',
          message: `Failed to remove ${ids.length} images from storage vault.`,
          severity: 'warning',
          technicalDetails: err?.message,
        });
        reject(err || new Error('Batch delete transaction aborted'));
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Clears all records from the image vault.
 */
export async function clearAllImageRecords(): Promise<void> {
  const db = await openImageVaultDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
      tx.objectStore(IMAGE_STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Duplicate check against existing items in the gallery by fileName and fileSize (or raw title).
 */
export function isDuplicateImageRecord(
  fileName: string,
  fileSize: number,
  existingItems: Array<{ fileName?: string; fileSize?: number; title?: string }>
): boolean {
  if (!fileName) return false;
  const cleanName = fileName.trim().toLowerCase();
  const rawTitle = fileName.replace(/\.[^/.]+$/, '').trim().toLowerCase();

  return existingItems.some((item) => {
    const itemFileName = (item.fileName || '').trim().toLowerCase();
    const itemTitle = (item.title || '').trim().toLowerCase();

    if (itemFileName && itemFileName === cleanName) {
      if (item.fileSize && item.fileSize === fileSize) return true;
      if (!item.fileSize) return true;
    }
    if (itemTitle && (itemTitle === rawTitle || itemTitle === cleanName)) {
      if (item.fileSize && item.fileSize === fileSize) return true;
    }
    return false;
  });
}

/**
 * Diagnostic helper to verify whether IndexedDB image vault is responsive.
 */
export async function testImageVaultConnection(): Promise<boolean> {
  try {
    if (typeof indexedDB === 'undefined') return false;
    const db = await openImageVaultDB();
    db.close();
    return true;
  } catch {
    return false;
  }
}

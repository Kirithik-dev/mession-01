import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { TrackItem, ImageItem } from '../types/media';
import { generateAmbientChronoTrack } from '../utils/audioGenerator';
import { getAudioFromVault, deleteAudioFromVault } from '../utils/audioStorage';
import {
  getOrRegisterImageUrl,
  revokeImageUrl,
  revokeImageUrls,
  revokeAllImageUrls,
  getAllImageRecords,
  saveImageRecord,
  deleteImageRecord,
  deleteImageRecords,
  clearAllImageRecords,
  StoredImageRecord,
} from '../utils/imageStorage';
import { recordAppError } from '../utils/errorCentre';
import {
  resolveDailySelection,
  getLocalCalendarDate,
  DailySelectionResult,
} from '../utils/dailySelectionService';

interface MediaLibraryContextType {
  // Independent Libraries
  songs: TrackItem[];
  images: ImageItem[];

  // Daily Selection API
  dailyTrack: TrackItem | null;
  dailyImage: ImageItem | null;
  dailySelectionDate: string;
  refreshDailySelection: () => Promise<void>;

  // Songs API
  addSong: (song: TrackItem) => void;
  addSongs: (songs: TrackItem[]) => void;
  removeSong: (id: string) => void;
  clearSongs: () => void;
  addDemoSong: () => void;

  // Images API
  addImage: (image: ImageItem) => void;
  addImages: (images: ImageItem[]) => void;
  removeImage: (id: string) => Promise<boolean>;
  removeImages: (ids: string[]) => Promise<boolean>;
  clearImages: () => Promise<void>;
  addDemoImages: () => void;

  // Audio Playback State & Controls
  currentTrackIndex: number;
  currentTrack: TrackItem | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playTrack: (index: number) => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
}

const MediaLibraryContext = createContext<MediaLibraryContextType | null>(null);

const STORAGE_KEY_SONGS = 'mission_media_songs_v2';
const STORAGE_KEY_IMAGES = 'mission_media_images_v2';

export const MediaLibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Songs state (starts empty to respect Case A initial condition)
  const [songs, setSongs] = useState<TrackItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SONGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Images state (starts empty to respect initial condition; rehydrated from IndexedDB)
  const [images, setImages] = useState<ImageItem[]>([]);

  // Persist songs metadata (excluding revoked blob URLs on reload)
  useEffect(() => {
    try {
      // Keep only persistent properties, or fallback demo regeneration
      const toStore = songs.map((s) => ({
        ...s,
        // Blob URLs expire across full page reloads, mark demo tracks
        src: s.isDemo ? '' : s.src,
      }));
      localStorage.setItem(STORAGE_KEY_SONGS, JSON.stringify(toStore));
    } catch {
      // ignore storage quota errors
    }
  }, [songs]);

  // Persist images metadata (excluding ephemeral object URLs to keep localStorage clean)
  useEffect(() => {
    try {
      const metadataOnly = images.map((img) => ({
        id: img.id,
        title: img.title,
        url: img.isDemo ? img.url : '', // Only retain external demo URLs; real images generate URLs from Blobs
        aspectRatio: img.aspectRatio,
        addedAt: img.addedAt,
        fileName: img.fileName,
        fileSize: img.fileSize,
        isDemo: img.isDemo,
      }));
      localStorage.setItem(STORAGE_KEY_IMAGES, JSON.stringify(metadataOnly));
    } catch {
      // ignore
    }
  }, [images]);

  // Rehydrate persistent images from IndexedDB vault on startup and safely migrate accessible legacy blobs
  useEffect(() => {
    let active = true;

    const initializeImageVault = async () => {
      try {
        const storedRecords = await getAllImageRecords();
        const storedIdSet = new Set(storedRecords.map((r) => r.id));

        // Safe migration of any legacy metadata in localStorage
        let legacyItems: ImageItem[] = [];
        try {
          const raw = localStorage.getItem(STORAGE_KEY_IMAGES);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) legacyItems = parsed;
          }
        } catch {
          // ignore
        }

        let expiredSessionCount = 0;
        const newlyMigrated: StoredImageRecord[] = [];

        for (const item of legacyItems) {
          if (!item.id || storedIdSet.has(item.id)) continue;

          if (item.url && (item.url.startsWith('blob:') || item.url.startsWith('data:') || item.url.startsWith('http'))) {
            try {
              const res = await fetch(item.url);
              if (res.ok) {
                const blob = await res.blob();
                const migratedRec: StoredImageRecord = {
                  id: item.id,
                  title: item.title || 'MIGRATED PHOTO',
                  blob,
                  fileName: item.fileName || `${item.title || 'photo'}.jpg`,
                  fileSize: blob.size,
                  mimeType: blob.type || 'image/jpeg',
                  addedAt: item.addedAt || Date.now(),
                  aspectRatio: item.aspectRatio,
                  isDemo: item.isDemo,
                };
                await saveImageRecord(migratedRec);
                newlyMigrated.push(migratedRec);
                storedIdSet.add(migratedRec.id);
              } else {
                expiredSessionCount++;
              }
            } catch {
              expiredSessionCount++;
            }
          } else {
            expiredSessionCount++;
          }
        }

        if (expiredSessionCount > 0) {
          recordAppError({
            operation: 'Image Migration',
            title: 'EXPIRED IMAGE SESSIONS CLEANED',
            message: `${expiredSessionCount} ${
              expiredSessionCount === 1 ? 'image reference' : 'image references'
            } had expired temporary session URLs from before persistent storage was enabled and could not be restored.`,
            severity: 'warning',
          });
        }

        const combinedRecords = [...newlyMigrated, ...storedRecords];
        // Chronological order: newest first
        combinedRecords.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

        if (!active) return;

        // Hydrate with fresh object URLs created from the persistent Blobs
        const liveImages: ImageItem[] = combinedRecords.map((rec) => ({
          id: rec.id,
          title: rec.title,
          url: getOrRegisterImageUrl(rec.id, rec.blob),
          aspectRatio: rec.aspectRatio,
          addedAt: rec.addedAt,
          fileName: rec.fileName,
          fileSize: rec.fileSize,
          isDemo: rec.isDemo,
        }));

        setImages(liveImages);
      } catch (err) {
        recordAppError({
          operation: 'Image Storage',
          title: 'IMAGE VAULT INITIALIZATION FAILED',
          message: err instanceof Error ? err.message : String(err),
          severity: 'critical',
        });
      }
    };

    initializeImageVault();

    return () => {
      active = false;
    };
  }, []);

  // Player state
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Daily Selection state
  const [dailyTrack, setDailyTrack] = useState<TrackItem | null>(null);
  const [dailyImage, setDailyImage] = useState<ImageItem | null>(null);
  const [dailySelectionDate, setDailySelectionDate] = useState<string>(getLocalCalendarDate);
  const hasAlignedDailyTrackRef = useRef<boolean>(false);

  const refreshDailySelection = useCallback(async () => {
    try {
      const res = await resolveDailySelection(songs, images);
      setDailySelectionDate(res.date);
      setDailyTrack(res.track);
      setDailyImage(res.image);

      if (res.track) {
        const foundIndex = songs.findIndex((s) => s.id === res.track!.id);
        if (foundIndex !== -1) {
          // On initial load or if current track is invalid, point to daily track
          if (!hasAlignedDailyTrackRef.current) {
            hasAlignedDailyTrackRef.current = true;
            setCurrentTrackIndex(foundIndex);
          } else {
            setCurrentTrackIndex((prev) => {
              if (prev < 0 || prev >= songs.length || !songs[prev]) {
                return foundIndex;
              }
              return prev;
            });
          }
        }
      }
    } catch (err) {
      console.warn('Daily selection sync error:', err);
    }
  }, [songs, images]);

  // Synchronize daily selection whenever library contents change
  useEffect(() => {
    refreshDailySelection();
  }, [refreshDailySelection]);

  // Periodic calendar date change detector (every 15s and on window focus)
  useEffect(() => {
    const handleDateTick = () => {
      const currentDate = getLocalCalendarDate();
      if (currentDate !== dailySelectionDate) {
        refreshDailySelection();
      }
    };

    const timer = setInterval(handleDateTick, 15000);
    window.addEventListener('focus', handleDateTick);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', handleDateTick);
    };
  }, [dailySelectionDate, refreshDailySelection]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const currentTrack = songs[currentTrackIndex] || null;

  // Sync track src changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack) {
      audio.pause();
      audio.src = '';
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    // If demo track lost its blob URL, synthesize a fresh one
    let src = currentTrack.src;
    if (!src && currentTrack.isDemo) {
      const demo = generateAmbientChronoTrack();
      src = demo.url;
      currentTrack.src = src;
    }

    if (audio.src !== src) {
      const wasPlaying = isPlaying;
      audio.src = src;
      audio.currentTime = 0;
      setCurrentTime(0);
      if (currentTrack.duration) {
        setDuration(currentTrack.duration);
      }

      if (wasPlaying) {
        audio.play().catch(() => setIsPlaying(false));
      }
    }
  }, [currentTrackIndex, currentTrack, isPlaying]);

  // Sync volume / mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Songs mutations
  const addSong = useCallback((song: TrackItem) => {
    setSongs((prev) => [...prev, song]);
  }, []);

  const addSongs = useCallback((newSongs: TrackItem[]) => {
    setSongs((prev) => [...prev, ...newSongs]);
  }, []);

  // Rehydrate persistent audio binaries from IndexedDB vault on app startup
  useEffect(() => {
    let active = true;
    const rehydrate = async () => {
      const updated = await Promise.all(
        songs.map(async (track) => {
          if (!track.isDemo) {
            const blob = await getAudioFromVault(track.id);
            if (blob && active) {
              return { ...track, src: URL.createObjectURL(blob) };
            }
          }
          return track;
        })
      );
      if (active) {
        const hasChange = updated.some((t, i) => t.src !== songs[i]?.src);
        if (hasChange) {
          setSongs(updated);
        }
      }
    };
    rehydrate();
    return () => {
      active = false;
    };
  }, []);

  const removeSong = useCallback((id: string) => {
    deleteAudioFromVault(id).catch(() => {});
    setSongs((prev) => {
      const next = prev.filter((s) => s.id !== id);
      return next;
    });
  }, []);

  const clearSongs = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setCurrentTrackIndex(0);
    setSongs([]);
    try {
      localStorage.removeItem(STORAGE_KEY_SONGS);
    } catch {
      // ignore
    }
  }, []);

  const addDemoSong = useCallback(() => {
    const demo = generateAmbientChronoTrack();
    const demoTrack: TrackItem = {
      id: `demo-${Date.now()}`,
      title: 'CHRONOS OVERTURE',
      artist: 'MISSION SOUND LAB',
      duration: demo.duration,
      src: demo.url,
      genre: 'Cinematic Ambient',
      addedAt: Date.now(),
      isDemo: true,
    };
    setSongs((prev) => [...prev, demoTrack]);
  }, []);

  // Images mutations
  const addImage = useCallback((img: ImageItem) => {
    setImages((prev) => [img, ...prev]);
  }, []);

  const addImages = useCallback((newImgs: ImageItem[]) => {
    setImages((prev) => [...newImgs, ...prev]);
  }, []);

  const removeImage = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteImageRecord(id);
      revokeImageUrl(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
      return true;
    } catch (err) {
      recordAppError({
        operation: 'Image Deletion',
        title: 'FAILED TO DELETE IMAGE',
        message: err instanceof Error ? err.message : String(err),
        severity: 'warning',
      });
      return false;
    }
  }, []);

  const removeImages = useCallback(async (ids: string[]): Promise<boolean> => {
    if (!ids || ids.length === 0) return true;
    try {
      await deleteImageRecords(ids);
      revokeImageUrls(ids);
      const idSet = new Set(ids);
      setImages((prev) => prev.filter((img) => !idSet.has(img.id)));
      return true;
    } catch (err) {
      recordAppError({
        operation: 'Image Deletion',
        title: 'FAILED TO DELETE IMAGES',
        message: err instanceof Error ? err.message : String(err),
        severity: 'warning',
      });
      return false;
    }
  }, []);

  const clearImages = useCallback(async (): Promise<void> => {
    try {
      await clearAllImageRecords();
    } catch (err) {
      console.warn('Could not clear IndexedDB image vault:', err);
    }
    revokeAllImageUrls();
    setImages([]);
    try {
      localStorage.removeItem(STORAGE_KEY_IMAGES);
    } catch {
      // ignore
    }
  }, []);

  const addDemoImages = useCallback(() => {
    const demoPhotos: ImageItem[] = [
      {
        id: `img-demo-1-${Date.now()}`,
        title: 'MONOLITH NOIR',
        url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
        aspectRatio: 1.5,
        addedAt: Date.now(),
        isDemo: true,
      },
      {
        id: `img-demo-2-${Date.now()}`,
        title: 'GEOMETRIC OBSIDIAN',
        url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
        aspectRatio: 1.33,
        addedAt: Date.now(),
        isDemo: true,
      },
      {
        id: `img-demo-3-${Date.now()}`,
        title: 'CELESTIAL CHRONO',
        url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
        aspectRatio: 1.5,
        addedAt: Date.now(),
        isDemo: true,
      },
    ];
    setImages((prev) => [...demoPhotos, ...prev]);
  }, []);

  // Player controls
  const playTrack = useCallback(
    (index: number) => {
      if (index < 0 || index >= songs.length) return;
      setCurrentTrackIndex(index);
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
    },
    [songs.length]
  );

  const togglePlay = useCallback(() => {
    if (!currentTrack) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [currentTrack, isPlaying]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setCurrentTime(seconds);
  }, []);

  const nextTrack = useCallback(() => {
    if (songs.length === 0) return;
    setCurrentTrackIndex((prev) => (prev + 1) % songs.length);
    setIsPlaying(true);
  }, [songs.length]);

  const prevTrack = useCallback(() => {
    if (songs.length === 0) return;
    setCurrentTrackIndex((prev) => (prev - 1 + songs.length) % songs.length);
    setIsPlaying(true);
  }, [songs.length]);

  const setVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  return (
    <MediaLibraryContext.Provider
      value={{
        songs,
        images,
        dailyTrack,
        dailyImage,
        dailySelectionDate,
        refreshDailySelection,
        addSong,
        addSongs,
        removeSong,
        clearSongs,
        addDemoSong,
        addImage,
        addImages,
        removeImage,
        removeImages,
        clearImages,
        addDemoImages,
        currentTrackIndex,
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        playTrack,
        togglePlay,
        seek,
        nextTrack,
        prevTrack,
        setVolume,
        toggleMute,
      }}
    >
      {children}
    </MediaLibraryContext.Provider>
  );
};

export const useMediaLibrary = (): MediaLibraryContextType => {
  const context = useContext(MediaLibraryContext);
  if (!context) {
    throw new Error('useMediaLibrary must be used within a MediaLibraryProvider');
  }
  return context;
};

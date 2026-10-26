import React, { useState, useRef, useEffect } from 'react';
import { Plus, MoreVertical, Trash2, HardDrive } from 'lucide-react';
import { useMediaLibrary } from '../context/MediaLibraryContext';
import { TrackItem } from '../types/media';
import { GalleryLiquidRibbonBackground } from './GalleryLiquidRibbonBackground';
import { saveAudioToVault } from '../utils/audioStorage';

/**
 * MISSION Phonk Tab — Storage-Only Music Library
 * 
 * Features:
 * - Dedicated storage vault for importing, viewing, and deleting Phonk MP3 files
 * - Zero playback UI (no play/pause, no audio players, no playback triggers)
 * - Clean header titled "PHONK LIBRARY" with live accurate track count
 * - Compact champagne-gold "+" button for importing MP3 files
 * - Duplicate prevention and graceful file filtering
 * - Persistent storage across restarts using localStorage metadata + IndexedDB audio vault
 * - Per-track overflow menu for file management (remove from library, view file details)
 * - Polished empty state reading "NO PHONK STORED"
 * - Living 3D liquid-ribbon background and bottom navigation dock preserved
 */
export const PhonkSection: React.FC = () => {
  const { songs, addSongs, removeSong } = useMediaLibrary();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Active track menu ID ('track-id' or null)
  const [openMenuTrackId, setOpenMenuTrackId] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  // Feedback notification for imports and library actions
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Close overflow menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setOpenMenuTrackId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Track existing filenames and titles for robust duplicate detection
    const existingNames = new Set(
      songs
        .flatMap((s) => [
          (s.fileName || '').trim().toLowerCase(),
          (s.title || '').trim().toLowerCase(),
        ])
        .filter(Boolean)
    );

    const newTracks: TrackItem[] = [];
    const now = Date.now();
    let duplicatesCount = 0;
    let unsupportedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // File validation: must be audio / mp3
      const isAudio =
        file.type.startsWith('audio/') ||
        /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name);

      if (!isAudio) {
        unsupportedCount++;
        continue;
      }

      const cleanFileName = file.name.trim();
      const rawTitle = file.name.replace(/\.[^/.]+$/, '').trim();

      // Check duplicates against existing library and current batch
      if (
        existingNames.has(cleanFileName.toLowerCase()) ||
        existingNames.has(rawTitle.toLowerCase())
      ) {
        duplicatesCount++;
        continue;
      }

      existingNames.add(cleanFileName.toLowerCase());
      existingNames.add(rawTitle.toLowerCase());

      const trackId = `phonk-${now}-${i}-${Math.random().toString(36).substring(2, 7)}`;
      const objectUrl = URL.createObjectURL(file);

      // Persist audio blob in IndexedDB vault across full app reloads
      saveAudioToVault(trackId, file).catch(() => {});

      newTracks.push({
        id: trackId,
        title: rawTitle.toUpperCase(),
        artist: 'PHONK VAULT',
        duration: 0,
        src: objectUrl,
        fileName: file.name,
        fileSize: file.size,
        addedAt: now - i * 10,
        isDemo: false,
      });
    }

    if (newTracks.length > 0) {
      addSongs(newTracks);
      if (duplicatesCount > 0) {
        showToast(
          `Imported ${newTracks.length} ${
            newTracks.length === 1 ? 'track' : 'tracks'
          } (${duplicatesCount} duplicate skipped)`
        );
      } else {
        showToast(
          `Stored ${newTracks.length} ${
            newTracks.length === 1 ? 'track' : 'tracks'
          } in library`
        );
      }
    } else if (duplicatesCount > 0) {
      showToast(
        `${duplicatesCount} duplicate ${
          duplicatesCount === 1 ? 'track' : 'tracks'
        } skipped`
      );
    } else if (unsupportedCount > 0) {
      showToast('Selected file format is not supported (MP3/audio only)');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-black text-white flex flex-col select-none overflow-hidden">
      {/* 3D Living Liquid-Ribbon Background (Continuous behind interface) */}
      <GalleryLiquidRibbonBackground />

      {/* Hidden File Picker Input for real MP3/Audio files */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3"
        multiple
        className="hidden"
        onChange={handleAudioFileChange}
      />

      {/* Main Content Area */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-4 sm:px-6 pt-[calc(env(safe-area-inset-top,20px)+12px)] pb-[100px] sm:pb-[110px] overflow-y-auto">
        {/* Toast Feedback Notification */}
        {toastMessage && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#18181C]/95 backdrop-blur-xl border border-[#C9A15B]/40 text-[#EDEDED] text-xs font-mono tracking-wide shadow-[0_12px_28px_rgba(0,0,0,0.85)] flex items-center gap-2 animate-fade-in pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A15B]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Central Charcoal Glass Library Panel (Modeled after reference UI) */}
        <div className="w-full max-w-[420px] h-[580px] sm:h-[620px] max-h-[calc(100vh-140px)] rounded-[36px] sm:rounded-[40px] bg-gradient-to-b from-[#222226] via-[#1B1B1E] to-[#141416] border border-white/[0.08] shadow-[0_30px_60px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.08)] p-5 sm:p-6 flex flex-col justify-between shrink-0 my-auto">
          {/* Header Row */}
          <div className="flex items-center justify-between shrink-0 pb-3 border-b border-white/[0.06]">
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-[0.16em] text-white uppercase font-sans">
                PHONK LIBRARY
              </h1>
              <p className="text-[11px] font-mono tracking-widest text-[#C9A15B] uppercase mt-0.5">
                {songs.length} {songs.length === 1 ? 'TRACK STORED' : 'TRACKS STORED'}
              </p>
            </div>

            {/* Compact Gold-Accented Add (+) Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-w-[40px] min-h-[40px] w-10 h-10 rounded-full flex items-center justify-center bg-[#161618] hover:bg-[#202024] active:bg-[#26262a] active:scale-95 transition-all text-[#C9A15B] hover:text-[#DFC289] border border-[#C9A15B]/40 hover:border-[#C9A15B] cursor-pointer shadow-md shadow-black/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A15B]"
              aria-label="Import MP3 files"
              title="Import MP3 Files"
            >
              <Plus className="w-5 h-5" strokeWidth={2.2} />
            </button>
          </div>

          {/* Vertically Scrollable Track List */}
          <div
            ref={menuContainerRef}
            className="flex-1 w-full my-3 overflow-y-auto pr-1 flex flex-col gap-1.5 min-h-0 select-none"
          >
            {songs.length === 0 ? (
              /* Polished Minimal Empty State (Preserved) */
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-6">
                <div className="w-13 h-13 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3.5 shadow-inner">
                  <HardDrive className="w-6 h-6 text-[#C9A15B]/70" />
                </div>
                <h2 className="text-xs font-mono font-semibold text-neutral-300 uppercase tracking-widest">
                  NO PHONK STORED
                </h2>
                <p className="text-[11px] text-neutral-500 mt-1.5 max-w-[240px] leading-relaxed">
                  Import MP3 files to build your wake-up frequency vault.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-5 py-2.5 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-[#C9A15B]/40 hover:border-[#C9A15B] text-xs font-mono uppercase tracking-[0.14em] text-[#C9A15B] flex items-center gap-2 cursor-pointer transition-all shadow-sm active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>IMPORT MP3 FILE</span>
                </button>
              </div>
            ) : (
              songs.map((track, idx) => {
                const isMenuOpen = openMenuTrackId === track.id;

                return (
                  <div
                    key={track.id}
                    className="relative w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-[16px] bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.03] transition-colors"
                  >
                    {/* Track Number */}
                    <span className="w-5 text-[11.5px] font-mono text-neutral-500 shrink-0 select-none">
                      {idx + 1}
                    </span>

                    {/* Track Metadata (No Playback Trigger) */}
                    <div className="flex-1 min-w-0 text-left">
                      <h3 className="text-[12.5px] sm:text-[13px] font-semibold text-neutral-200 truncate font-sans">
                        {track.title || track.fileName}
                      </h3>
                      <p className="text-[10.5px] font-mono text-neutral-400 truncate mt-0.5">
                        {track.fileName && track.fileName !== track.title
                          ? track.fileName
                          : track.artist || 'PHONK VAULT'}
                        {track.fileSize ? ` • ${formatFileSize(track.fileSize)}` : ''}
                      </p>
                    </div>

                    {/* Subtle Overflow Menu for File Management */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuTrackId(isMenuOpen ? null : track.id)
                        }
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                        aria-label="Track options"
                        title="File actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div className="absolute right-0 top-8 w-48 rounded-[16px] bg-[#161619]/95 backdrop-blur-xl border border-white/[0.1] shadow-[0_16px_36px_rgba(0,0,0,0.9)] p-1.5 z-30 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                          <div className="px-2.5 py-1 text-[10px] font-mono text-neutral-400 truncate border-b border-white/[0.06] mb-0.5">
                            {track.fileName || track.title}
                          </div>
                          {track.fileSize ? (
                            <div className="px-2.5 py-0.5 text-[9.5px] font-mono text-neutral-500">
                              Size: {formatFileSize(track.fileSize)}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              removeSong(track.id);
                              setOpenMenuTrackId(null);
                              showToast('Track removed from library');
                            }}
                            className="w-full px-2.5 py-1.5 text-left text-xs font-mono text-red-400 hover:text-red-300 hover:bg-white/[0.08] rounded-lg flex items-center gap-2 cursor-pointer transition-colors mt-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove from Library</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Info / Storage Summary (Accurate to local storage behavior) */}
          <div className="shrink-0 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[10.5px] font-mono text-neutral-500">
            <span>OFFLINE VAULT</span>
            <span>LOCAL MP3 STORAGE</span>
          </div>
        </div>
      </div>
    </div>
  );
};

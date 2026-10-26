import React, { useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, X, Check } from 'lucide-react';
import { useMediaLibrary } from '../context/MediaLibraryContext';
import { ImageItem } from '../types/media';
import { GalleryLiquidRibbonBackground } from './GalleryLiquidRibbonBackground';

interface DateGroup {
  key: string;
  label: string;
  order: number;
  items: ImageItem[];
}

/**
 * MISSION Gallery Section
 * - Pure near-black background
 * - Compact top header with 'Gallery' title and elegant '+' button
 * - Four-column portrait-oriented rounded thumbnail grid
 * - Dynamic date grouping: Today, Yesterday, day names, and month-year groups
 * - Minimal empty state displaying only 'NO IMAGES FOUND'
 * - Long-press (450ms) to enter selection mode with champagne-gold indicators
 * - Multi-selection across date groups with count header and cancel action
 * - Batch deletion with confirmation modal
 * - Fullscreen lightbox with deletion confirmation
 */
export const ImagesGallerySection: React.FC = () => {
  const { images, addImages, removeImage, removeImages } = useMediaLibrary();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fullscreen lightbox state
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);

  // Multi-selection state
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Confirmation modal state ('selection' | 'single' | null) & guard against duplicate clicks
  const [confirmDeleteType, setConfirmDeleteType] = useState<'selection' | 'single' | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Long-press detection refs
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const didLongPressRef = useRef<boolean>(false);

  const clearPressTimer = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback((imgId: string, e: React.PointerEvent) => {
    // Only primary mouse button or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    clearPressTimer();
    didLongPressRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };

    // If already in selection mode, tapping toggles immediately on click; no need for long-press timer
    if (isSelectionMode) return;

    // Hold threshold: 450ms
    pressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(20);
        }
      } catch {
        // ignore
      }
      setIsSelectionMode(true);
      setSelectedIds(new Set([imgId]));
    }, 450);
  }, [clearPressTimer, isSelectionMode]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerStartRef.current) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    // Cancel if scrolled or moved more than 8px
    if (Math.hypot(dx, dy) > 8) {
      clearPressTimer();
    }
  }, [clearPressTimer]);

  const handlePointerUpOrCancel = useCallback(() => {
    clearPressTimer();
    pointerStartRef.current = null;
  }, [clearPressTimer]);

  const handleThumbnailClick = useCallback((img: ImageItem) => {
    // If long-press triggered, suppress subsequent click event
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }

    if (isSelectionMode) {
      // Toggle selection in multi-select mode
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(img.id)) {
          next.delete(img.id);
        } else {
          next.add(img.id);
        }
        return next;
      });
    } else {
      // Normal tap opens fullscreen lightbox
      setSelectedImage(img);
    }
  }, [isSelectionMode]);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
    setConfirmDeleteType(null);
    setIsDeleting(false);
  }, []);

  const handleExecuteDelete = useCallback(() => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      if (confirmDeleteType === 'selection') {
        const ids = Array.from(selectedIds);
        removeImages(ids);
        exitSelectionMode();
      } else if (confirmDeleteType === 'single') {
        if (selectedImage) {
          removeImage(selectedImage.id);
          setSelectedImage(null);
        }
        setConfirmDeleteType(null);
      }
    } finally {
      setIsDeleting(false);
    }
  }, [confirmDeleteType, exitSelectionMode, isDeleting, removeImage, removeImages, selectedIds, selectedImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: ImageItem[] = [];
    const now = Date.now();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const objectUrl = URL.createObjectURL(file);
      const title = file.name.replace(/\.[^/.]+$/, '').toUpperCase();

      newItems.push({
        id: `img-${now}-${i}-${Math.random().toString(36).substring(2, 7)}`,
        title,
        url: objectUrl,
        addedAt: now - i * 10,
        isDemo: false,
      });
    }

    addImages(newItems);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Chronological date grouping helper
  const groupedImages = useMemo<DateGroup[]>(() => {
    if (!images || images.length === 0) return [];

    // Sort images newest first
    const sorted = [...images].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    const groupsMap = new Map<string, DateGroup>();

    for (const img of sorted) {
      const timestamp = img.addedAt || Date.now();
      const d = new Date(timestamp);
      const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const diffDays = Math.round((todayMidnight - dMidnight) / oneDayMs);

      let key: string;
      let label: string;
      let order: number;

      if (diffDays === 0) {
        key = 'today';
        label = 'Today';
        order = 0;
      } else if (diffDays === 1) {
        key = 'yesterday';
        label = 'Yesterday';
        order = 1;
      } else if (diffDays > 1 && diffDays < 7) {
        const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d);
        key = `weekday-${d.getDay()}`;
        label = weekday;
        order = diffDays;
      } else {
        const monthYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);
        key = `month-${d.getFullYear()}-${d.getMonth()}`;
        label = monthYear;
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        order = 10000000000000 - monthStart;
      }

      let group = groupsMap.get(key);
      if (!group) {
        group = { key, label, order, items: [] };
        groupsMap.set(key, group);
      }
      group.items.push(img);
    }

    return Array.from(groupsMap.values()).sort((a, b) => a.order - b.order);
  }, [images]);

  const hasImages = Boolean(images && images.length > 0);

  return (
    <div className="relative w-full h-full min-h-screen bg-black text-white flex flex-col select-none overflow-hidden">
      {/* Cinematic 3D Living Liquid-Ribbon Background */}
      <GalleryLiquidRibbonBackground />

      {/* Hidden file input for uploading images */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top Header: Swaps smoothly between Default and Selection Mode */}
      {isSelectionMode ? (
        <header className="flex items-center justify-between px-4 sm:px-6 pt-[calc(env(safe-area-inset-top,20px)+12px)] pb-2 z-20 shrink-0 border-b border-white/[0.06] bg-black/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={exitSelectionMode}
              className="min-w-[40px] min-h-[40px] w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.08] hover:bg-white/[0.14] text-neutral-300 hover:text-white transition-all cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              aria-label="Cancel selection"
              title="Cancel selection"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-xs sm:text-sm font-mono font-semibold tracking-wider text-white uppercase select-none">
              {selectedIds.size} SELECTED
            </span>
          </div>

          <button
            type="button"
            onClick={() => setConfirmDeleteType('selection')}
            disabled={selectedIds.size === 0}
            className="min-h-[38px] px-3.5 py-1.5 rounded-full flex items-center gap-1.5 bg-[#121212] hover:bg-[#1C1810] active:bg-[#252014] hover:border-[#D6B66B] active:scale-95 border border-[#BFA15A] text-[#F2F2F2] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer text-xs font-mono font-medium tracking-wide focus:outline-none focus-visible:ring-1 focus-visible:ring-[#BFA15A]"
            aria-label={`Delete ${selectedIds.size} selected images`}
            title="Delete selected images"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#D6B66B] shrink-0" />
            <span className="text-[#F2F2F2]">Delete</span>
          </button>
        </header>
      ) : (
        <header className="flex items-center justify-between px-4 sm:px-6 pt-[calc(env(safe-area-inset-top,20px)+12px)] pb-2 z-20 shrink-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
            Gallery
          </h1>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-w-[44px] min-h-[44px] w-10 h-10 rounded-full flex items-center justify-center bg-white/[0.08] hover:bg-white/[0.14] active:scale-95 transition-all text-[#C9A15B] border border-white/[0.06] cursor-pointer shadow-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A15B]"
            aria-label="Add photos"
            title="Add photos"
          >
            <Plus className="w-5 h-5" strokeWidth={2.2} />
          </button>
        </header>
      )}

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden">
        {!hasImages ? (
          /* Minimal empty state: pure restrained text */
          <div className="flex-1 flex items-center justify-center w-full px-6 text-center">
            <p className="text-xs sm:text-[13px] font-mono font-medium tracking-[0.25em] text-[#A1A1AA] uppercase select-none">
              NO IMAGES FOUND
            </p>
          </div>
        ) : (
          /* Thumbnail Grid Grouped by Date */
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-28 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {groupedImages.map((group) => (
              <section key={group.key} className="mb-6">
                <div className="pb-2 pt-1">
                  <h2 className="text-xs sm:text-sm font-medium tracking-normal text-neutral-400">
                    {group.label}
                  </h2>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 sm:gap-2.5">
                  {group.items.map((img) => {
                    const isSelected = selectedIds.has(img.id);

                    return (
                      <button
                        key={img.id}
                        type="button"
                        onPointerDown={(e) => handlePointerDown(img.id, e)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUpOrCancel}
                        onPointerCancel={handlePointerUpOrCancel}
                        onClick={() => handleThumbnailClick(img)}
                        onContextMenu={(e) => e.preventDefault()}
                        className={`group relative aspect-[4/5] rounded-xl sm:rounded-2xl overflow-hidden bg-neutral-900 focus:outline-none transition-all duration-150 text-left cursor-pointer touch-manipulation ${
                          isSelected
                            ? 'ring-2 ring-[#C9A15B] ring-offset-2 ring-offset-black scale-[0.96]'
                            : isSelectionMode
                            ? 'opacity-85 hover:opacity-100'
                            : 'active:scale-[0.97]'
                        }`}
                        aria-label={
                          isSelectionMode
                            ? `${isSelected ? 'Deselect' : 'Select'} photo ${img.title || ''}`
                            : `View photo ${img.title || ''}`
                        }
                      >
                        <img
                          src={img.url}
                          alt={img.title || 'Gallery photo'}
                          loading="lazy"
                          draggable={false}
                          referrerPolicy="no-referrer"
                          className={`w-full h-full object-cover transition-transform duration-300 pointer-events-none select-none ${
                            !isSelectionMode ? 'group-hover:scale-105' : ''
                          }`}
                        />

                        {/* Selection Mode Badges */}
                        {isSelectionMode && (
                          <div className="absolute top-1.5 right-1.5 z-10 pointer-events-none">
                            {isSelected ? (
                              <div className="w-5 h-5 rounded-full bg-[#C9A15B] text-black flex items-center justify-center shadow-md">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border border-white/50 bg-black/40 backdrop-blur-xs flex items-center justify-center shadow-xs" />
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 select-none"
          >
            {/* Lightbox Top Bar */}
            <div
              className="flex items-center justify-between w-full pt-[calc(env(safe-area-inset-top,16px))] pb-2 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setConfirmDeleteType('single')}
                className="min-w-[44px] min-h-[44px] w-10 h-10 rounded-full bg-white/10 hover:bg-[#1C1810] text-neutral-300 hover:text-[#D6B66B] hover:border hover:border-[#BFA15A]/40 flex items-center justify-center transition-colors cursor-pointer"
                title="Delete photo"
                aria-label="Delete photo"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="min-w-[44px] min-h-[44px] w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Close preview"
                aria-label="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lightbox Photo Center */}
            <div
              className="flex-1 flex items-center justify-center p-2 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.img
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.2 }}
                src={selectedImage.url}
                alt={selectedImage.title || 'Full photo preview'}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[75vh] object-contain rounded-xl sm:rounded-2xl shadow-2xl"
              />
            </div>

            {/* Lightbox Bottom Info */}
            <div
              className="pb-[calc(env(safe-area-inset-bottom,16px))] pt-2 text-center z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs sm:text-sm font-sans font-medium tracking-wide text-neutral-200 uppercase truncate px-4">
                {selectedImage.title}
              </p>
              <p className="text-[11px] font-mono text-neutral-500 tracking-wider mt-1">
                {new Intl.DateTimeFormat('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(selectedImage.addedAt))}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Master Polish: Premium Image Deletion Confirmation Dialog */}
      <AnimatePresence>
        {confirmDeleteType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none"
            onClick={() => {
              if (!isDeleting) setConfirmDeleteType(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-dialog-title"
              aria-describedby="delete-dialog-desc"
              className="bg-[#141418] border border-[#C9A15B]/30 rounded-2xl sm:rounded-3xl p-6 sm:p-7 max-w-[320px] w-full text-center shadow-2xl shadow-black/90 relative overflow-hidden"
            >
              {/* Subtle ambient champagne glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-20 bg-[#C9A15B]/10 blur-2xl pointer-events-none rounded-full" />

              {/* Trash icon with champagne-gold badge */}
              <div className="relative w-12 h-12 rounded-full bg-[#C9A15B]/10 border border-[#C9A15B]/25 flex items-center justify-center mx-auto mb-4 text-[#C9A15B] shadow-[0_0_15px_rgba(201,161,91,0.15)]">
                <Trash2 className="w-5 h-5 text-[#C9A15B]" strokeWidth={2} />
              </div>

              {/* Title & Description */}
              <h3
                id="delete-dialog-title"
                className="text-base font-semibold text-white tracking-tight font-sans"
              >
                {confirmDeleteType === 'selection'
                  ? selectedIds.size === 1
                    ? 'Delete 1 image?'
                    : `Delete ${selectedIds.size} images?`
                  : 'Delete 1 image?'}
              </h3>
              <p
                id="delete-dialog-desc"
                className="text-xs font-mono text-neutral-400 mt-1.5 tracking-wide leading-relaxed"
              >
                This action cannot be undone.
              </p>

              {/* Buttons: Dark Charcoal CANCEL & Champagne-Gold DELETE */}
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    if (!isDeleting) setConfirmDeleteType(null);
                  }}
                  className="flex-1 min-h-[42px] px-4 py-2.5 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] active:scale-[0.98] border border-white/10 text-neutral-300 hover:text-white text-xs font-mono font-medium tracking-wider uppercase transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleExecuteDelete}
                  className="flex-1 min-h-[42px] px-4 py-2.5 rounded-xl bg-[#C9A15B] hover:bg-[#D5B06B] active:scale-[0.98] text-[#0B0B0E] font-semibold text-xs font-mono tracking-wider uppercase transition-all shadow-[0_0_14px_rgba(201,161,91,0.25)] cursor-pointer disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A15B]"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

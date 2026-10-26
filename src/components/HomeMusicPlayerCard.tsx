import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Music2 } from 'lucide-react';
import { useMediaLibrary } from '../context/MediaLibraryContext';

/**
 * Format seconds into mm:ss
 */
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * MISSION Royal Vinyl Disc SVG Component
 * Precision micro-grooves, subtle metallic radial gradient, and champagne-gold spindle accent (#C9A15B / #F5D89A)
 */
const RoyalVinylDisc: React.FC<{ isSpinning?: boolean; sizeClass?: string }> = ({
  isSpinning = false,
  sizeClass = 'w-13 h-13 sm:w-14 sm:h-14',
}) => {
  return (
    <div className={`relative ${sizeClass} flex items-center justify-center select-none`}>
      <motion.svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        animate={isSpinning ? { rotate: 360 } : { rotate: 0 }}
        transition={
          isSpinning
            ? { repeat: Infinity, duration: 6, ease: 'linear' }
            : { duration: 0.5, ease: 'easeOut' }
        }
      >
        <defs>
          <radialGradient id="homeVinylGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a1a1f" />
            <stop offset="40%" stopColor="#24242a" />
            <stop offset="70%" stopColor="#161619" />
            <stop offset="90%" stopColor="#2c2c33" />
            <stop offset="100%" stopColor="#1c1c20" />
          </radialGradient>
          <radialGradient id="homeGoldCenter" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F5D89A" />
            <stop offset="60%" stopColor="#C9A15B" />
            <stop offset="100%" stopColor="#8A6529" />
          </radialGradient>
          <linearGradient id="homeGrooveSheen" x1="0" y1="0" x2="100" y2="100">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="50%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
          </linearGradient>
        </defs>

        {/* Outer Vinyl Body */}
        <circle cx="50" cy="50" r="48" fill="url(#homeVinylGrad)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
        
        {/* Subtle dynamic sheen reflection overlay */}
        <circle cx="50" cy="50" r="48" fill="url(#homeGrooveSheen)" />

        {/* Precision Micro-Grooves */}
        <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
        <circle cx="50" cy="50" r="37" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        <circle cx="50" cy="50" r="32" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
        <circle cx="50" cy="50" r="27" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        <circle cx="50" cy="50" r="22" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

        {/* Center Label Platter */}
        <circle cx="50" cy="50" r="17" fill="#141418" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
        <circle cx="50" cy="50" r="12" stroke="rgba(201,161,91,0.3)" strokeWidth="0.5" />

        {/* Spindle hole with champagne-gold hub */}
        <circle cx="50" cy="50" r="4.5" fill="url(#homeGoldCenter)" />
        <circle cx="50" cy="50" r="1.8" fill="#0b0b0e" />
      </motion.svg>

      {/* Gentle Champagne Gold Ambient Glow around Center Spindle */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute w-2 h-2 rounded-full bg-[#C9A15B]/40 blur-[2px]"
      />
    </div>
  );
};

/**
 * MISSION Home Music Player Card
 *
 * Strict Architectural Invariants:
 * 1. INFORMATIONAL ONLY: Zero action buttons, upload triggers, demo buttons, or library management controls.
 *    (All music management is exclusively handled in the Phonk tab; covers in Images tab).
 * 2. EMPTY STATE:
 *    - Small, elegant disc icon with restrained champagne-gold center
 *    - "NO SONGS FOUND"
 *    - "Your music library is empty."
 *    - Vertically centered within card with generous spacing and premium minimal aesthetic.
 * 3. INDEPENDENT LIBRARIES:
 *    - Songs and covers are completely separate collections.
 *    - "NO COVERS FOUND" NEVER appears here.
 *    - If songs exist, displays reactive playback state.
 */
export const HomeMusicPlayerCard: React.FC = () => {
  const {
    songs,
    currentTrackIndex,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    isMuted,
    togglePlay,
    seek,
    nextTrack,
    prevTrack,
    toggleMute,
  } = useMediaLibrary();

  const hasSongs = songs.length > 0 && currentTrack !== null;

  return (
    <div
      aria-label={hasSongs ? 'Music Player' : 'Music Library - Empty'}
      className="relative w-full max-w-[310px] sm:max-w-[325px] aspect-[1/0.95] rounded-[26px] sm:rounded-[28px] p-2 bg-[#222225] border border-white/[0.06] shadow-[0_22px_48px_rgba(0,0,0,0.85)] select-none overflow-hidden transition-all duration-300"
    >
      {/* Inner Album Player Surface */}
      <div
        className={`relative w-full h-full rounded-[21px] sm:rounded-[23px] bg-gradient-to-b from-[#2e2e33] to-[#252529] border border-white/[0.07] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] flex flex-col items-center ${
          hasSongs ? 'justify-between p-4 sm:p-4.5' : 'justify-center p-6'
        } text-center overflow-hidden`}
      >
        {/* Subtle background radial reflection */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-[21px] sm:rounded-[23px] pointer-events-none opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.09) 0%, transparent 68%)',
          }}
        />

        <AnimatePresence mode="wait">
          {!hasSongs ? (
            /* ===================================================================
               EMPTY STATE: Minimal Royal Informational Composition
               - Strictly informational: zero buttons, zero clickable actions
               - Refined vinyl disc with champagne-gold center
               - Header: "NO SONGS FOUND"
               - Subtitle: "Your music library is empty."
               =================================================================== */
            <motion.div
              key="empty-state"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full flex flex-col items-center justify-center my-auto px-2"
            >
              {/* Refined Disc Emblem */}
              <div className="relative z-10 mb-4">
                <RoyalVinylDisc isSpinning={false} sizeClass="w-13 h-13 sm:w-14 sm:h-14" />
              </div>

              {/* Primary Empty State Header */}
              <h3 className="relative z-10 text-[13px] sm:text-[14px] font-mono font-bold tracking-[0.2em] text-[#EDEDED] uppercase">
                NO SONGS FOUND
              </h3>

              {/* Subtitle */}
              <p className="relative z-10 text-xs text-[#9CA3AF] font-normal tracking-wide mt-2">
                Your music library is empty.
              </p>
            </motion.div>
          ) : (
            /* ===================================================================
               ACTIVE PLAYER: Royal Minimal Tactile Audio Player
               - Rotating Vinyl Record with real-time spin state
               - Track title & artist
               - Scrub bar with elapsed / total time
               - Skip Prev / Play-Pause with gold accent / Skip Next
               - Volume toggle
               - Zero management controls (library managed in Phonk tab)
               =================================================================== */
            <motion.div
              key="active-player"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full h-full flex flex-col justify-between"
            >
              {/* Card Top Row: Track index & Informational Format Label */}
              <div className="flex items-center justify-between w-full px-1">
                <span className="text-[10px] font-mono tracking-[0.18em] text-[#9CA3AF]/80 uppercase">
                  TRACK {currentTrackIndex + 1} OF {songs.length}
                </span>

                <span className="text-[9.5px] font-mono tracking-[0.16em] text-[#C9A15B]/75 uppercase">
                  MISSION AUDIO
                </span>
              </div>

              {/* Center Composition: Rotating Vinyl & Track Information */}
              <div className="flex items-center gap-3.5 px-1 my-auto">
                <div className="shrink-0">
                  <RoyalVinylDisc isSpinning={isPlaying} sizeClass="w-14 h-14 sm:w-16 sm:h-16" />
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <h4 className="text-[12.5px] sm:text-[13px] font-mono font-bold tracking-[0.14em] text-[#EDEDED] truncate uppercase">
                    {currentTrack?.title || 'UNTITLED'}
                  </h4>
                  <p className="text-[11px] text-[#9CA3AF] tracking-wide truncate mt-0.5">
                    {currentTrack?.artist || 'UNKNOWN ARTIST'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isPlaying ? 'bg-[#C9A15B] animate-pulse' : 'bg-white/20'
                      }`}
                    />
                    <span className="text-[9.5px] font-mono tracking-widest text-[#9CA3AF]/60 uppercase">
                      {isPlaying ? 'PLAYING' : 'PAUSED'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Section: Progress Scrubber & Playback Controls */}
              <div className="w-full flex flex-col gap-2 pt-1">
                {/* Seek Bar */}
                <div className="w-full">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={(e) => seek(parseFloat(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#C9A15B] focus:outline-none"
                    aria-label="Seek track position"
                  />
                  <div className="flex justify-between items-center text-[10px] font-mono text-[#9CA3AF]/70 mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Tactile Control Buttons */}
                <div className="flex items-center justify-between px-2 pt-0.5">
                  {/* Volume Toggle */}
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-1.5 text-[#9CA3AF] hover:text-[#EDEDED] transition-colors cursor-pointer"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 text-red-400/80" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>

                  {/* Playback Controls (Prev, Play/Pause, Next) */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={prevTrack}
                      className="p-1.5 text-[#9CA3AF] hover:text-white transition-colors cursor-pointer hover:scale-105 active:scale-95"
                      aria-label="Previous Track"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={togglePlay}
                      className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.14] active:bg-white/[0.2] border border-[#C9A15B]/50 flex items-center justify-center text-[#F5D89A] shadow-[0_0_8px_rgba(201,161,91,0.25)] transition-all cursor-pointer hover:scale-105 active:scale-95"
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={nextTrack}
                      className="p-1.5 text-[#9CA3AF] hover:text-white transition-colors cursor-pointer hover:scale-105 active:scale-95"
                      aria-label="Next Track"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Music Mode Indicator */}
                  <div className="p-1.5 opacity-60">
                    <Music2 className="w-4 h-4 text-[#C9A15B]" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

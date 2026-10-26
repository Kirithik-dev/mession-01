import React from 'react';
import { useMediaLibrary } from '../context/MediaLibraryContext';
import { Sliders, Music, Image, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';

export const SettingsSection: React.FC = () => {
  const { songs, images, clearSongs, clearImages, addDemoSong, addDemoImages } = useMediaLibrary();

  return (
    <div className="relative w-full h-full min-h-screen bg-[#050507] text-white flex flex-col pt-[calc(env(safe-area-inset-top,24px)+16px)] pb-[108px] px-4 sm:px-6 select-none overflow-y-auto">
      <div className="w-full max-w-sm mx-auto flex flex-col gap-4">
        {/* Title */}
        <div className="border-b border-white/[0.08] pb-3 text-left">
          <h2 className="text-sm font-mono tracking-[0.2em] uppercase text-[#EDEDED] font-semibold flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#C9A15B]" />
            <span>MISSION CONTROLS</span>
          </h2>
          <p className="text-[11px] font-mono text-[#9CA3AF] tracking-wider mt-0.5">
            System & Media Library Configuration
          </p>
        </div>

        {/* Media Library Inspector Card */}
        <div className="rounded-2xl p-4 bg-[#1a1a1f] border border-white/[0.07] text-left">
          <span className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-[#C9A15B]">
            Independent Media Libraries
          </span>

          <div className="mt-3 flex flex-col gap-3">
            {/* Audio Library Status */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              <div className="flex items-center gap-2.5">
                <Music className="w-4 h-4 text-[#9CA3AF]" />
                <div>
                  <p className="text-xs font-mono text-white">Audio Library</p>
                  <p className="text-[10.5px] font-mono text-[#9CA3AF]">
                    {songs.length} {songs.length === 1 ? 'song' : 'songs'} installed
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {songs.length === 0 ? (
                  <button
                    type="button"
                    onClick={addDemoSong}
                    className="px-2 py-1 text-[10px] font-mono rounded bg-white/[0.06] hover:bg-white/[0.12] text-[#C9A15B] cursor-pointer"
                  >
                    + Add Demo
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={clearSongs}
                    className="px-2 py-1 text-[10px] font-mono rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Images Library Status */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              <div className="flex items-center gap-2.5">
                <Image className="w-4 h-4 text-[#9CA3AF]" />
                <div>
                  <p className="text-xs font-mono text-white">Image Archive</p>
                  <p className="text-[10.5px] font-mono text-[#9CA3AF]">
                    {images.length} {images.length === 1 ? 'image' : 'images'} installed
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {images.length === 0 ? (
                  <button
                    type="button"
                    onClick={addDemoImages}
                    className="px-2 py-1 text-[10px] font-mono rounded bg-white/[0.06] hover:bg-white/[0.12] text-[#C9A15B] cursor-pointer"
                  >
                    + Add Demo
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={clearImages}
                    className="px-2 py-1 text-[10px] font-mono rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Scenario Tester for Evaluator */}
        <div className="rounded-2xl p-4 bg-[#1a1a1f] border border-white/[0.07] text-left">
          <span className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-[#EDEDED]/80">
            Rapid Library Scenario Quick Switch
          </span>
          <p className="text-[10.5px] text-[#9CA3AF] mt-0.5 mb-2.5">
            Test independent library state scenarios with one tap:
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                clearSongs();
                clearImages();
              }}
              className="p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-left cursor-pointer"
            >
              <p className="text-[11px] font-mono text-white font-semibold">Case A</p>
              <p className="text-[9.5px] text-[#9CA3AF]">Empty Songs & Images</p>
            </button>

            <button
              type="button"
              onClick={() => {
                clearSongs();
                addDemoImages();
              }}
              className="p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-left cursor-pointer"
            >
              <p className="text-[11px] font-mono text-white font-semibold">Case B</p>
              <p className="text-[9.5px] text-[#9CA3AF]">Images Only (No Songs)</p>
            </button>

            <button
              type="button"
              onClick={() => {
                addDemoSong();
                clearImages();
              }}
              className="p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-left cursor-pointer"
            >
              <p className="text-[11px] font-mono text-white font-semibold">Case C</p>
              <p className="text-[9.5px] text-[#9CA3AF]">Songs Only (No Images)</p>
            </button>

            <button
              type="button"
              onClick={() => {
                addDemoSong();
                addDemoImages();
              }}
              className="p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-left cursor-pointer"
            >
              <p className="text-[11px] font-mono text-white font-semibold">Case D</p>
              <p className="text-[9.5px] text-[#9CA3AF]">Both Active</p>
            </button>
          </div>
        </div>

        {/* System Build Specs */}
        <div className="rounded-2xl p-4 bg-[#141418] border border-white/[0.04] text-left text-[11px] font-mono text-[#9CA3AF] flex flex-col gap-1">
          <div className="flex justify-between">
            <span>ENGINE</span>
            <span className="text-white">CHRONOS V2.4</span>
          </div>
          <div className="flex justify-between">
            <span>PALETTE</span>
            <span className="text-[#C9A15B]">CHAMPAGNE-BRONZE</span>
          </div>
          <div className="flex justify-between">
            <span>SECURITY</span>
            <span className="text-emerald-400">ISOLATED SANDBOX</span>
          </div>
        </div>
      </div>
    </div>
  );
};

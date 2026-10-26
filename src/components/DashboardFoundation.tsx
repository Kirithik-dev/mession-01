import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { TopNavigationDock } from './TopNavigationDock';
import { ChronosParticleClock } from './ChronosParticleClock';
import { AlarmControlCentre } from './AlarmControlCentre';
import { ImagesGallerySection } from './ImagesGallerySection';
import { PhonkSection } from './PhonkSection';
import { SettingsSection } from './SettingsSection';
import { TabId } from '../types/mission';

/**
 * MISSION Dashboard Foundation Component
 * Houses the floating bottom navigation bar and manages active section state:
 * - 'home': Immersive CHRONOS Realtime Particle Clock & Dynamic Music Player
 * - 'clock': Alarm Control Centre & Hanging Industrial Lamp
 * - 'images': Independent Image Archive & Gallery
 * - 'phonk': Midnight Drift Frequency Radio
 * - 'settings': System & Media Configuration
 */
export const DashboardFoundation: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('home');

  return (
    <div className="relative w-full h-full bg-[#050507] text-white overflow-hidden select-none flex flex-col justify-between">
      {/* Main Section Viewport Container */}
      <main className="relative z-10 flex-1 w-full h-full">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.section
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Home Section - CHRONOS Particle Clock"
              className="w-full h-full absolute inset-0 overflow-hidden"
            >
              <ChronosParticleClock />
            </motion.section>
          )}

          {activeTab === 'clock' && (
            <motion.section
              key="clock"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Clock Section"
              className="w-full h-full absolute inset-0 overflow-hidden"
            >
              <AlarmControlCentre />
            </motion.section>
          )}

          {activeTab === 'images' && (
            <motion.section
              key="images"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Images Section"
              className="w-full h-full absolute inset-0 overflow-hidden"
            >
              <ImagesGallerySection />
            </motion.section>
          )}

          {activeTab === 'phonk' && (
            <motion.section
              key="phonk"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Phonk Section"
              className="w-full h-full absolute inset-0 overflow-hidden"
            >
              <PhonkSection />
            </motion.section>
          )}

          {activeTab === 'settings' && (
            <motion.section
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Settings Section"
              className="w-full h-full absolute inset-0 overflow-hidden"
            >
              <SettingsSection />
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Cinematic Floating Bottom Navigation with Illuminated Lamp Effect */}
      <TopNavigationDock activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

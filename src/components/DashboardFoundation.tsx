import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { TopNavigationDock } from './TopNavigationDock';
import { ChronosParticleClock } from './ChronosParticleClock';
import { AlarmControlCentre } from './AlarmControlCentre';
import { TabId } from '../types/mission';

/**
 * MISSION Dashboard Foundation Component
 * Houses the floating bottom navigation bar and manages active section state:
 * - 'home': Immersive CHRONOS Realtime Particle Clock (Upper Composition)
 * - 'clock': Alarm Control Centre & Chrono Tools
 * - 'images', 'phonk', 'settings': Clean sections
 */
export const DashboardFoundation: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('home');

  return (
    <div className="relative w-full h-full min-h-screen bg-[#030305] text-white overflow-hidden select-none flex flex-col justify-between">
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
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Clock Section - Alarm Control Centre"
              className="w-full h-full absolute inset-0 overflow-hidden flex flex-col items-center justify-start"
            >
              <AlarmControlCentre />
            </motion.section>
          )}

          {activeTab !== 'home' && activeTab !== 'clock' && (
            <motion.section
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              aria-label={`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Section`}
              className="w-full h-full absolute inset-0 flex items-center justify-center"
            />
          )}
        </AnimatePresence>
      </main>

      {/* Cinematic Floating Bottom Navigation with Illuminated Lamp Effect */}
      <TopNavigationDock activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

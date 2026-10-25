import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CinematicLaunchScreen } from './CinematicLaunchScreen';
import { DashboardFoundation } from './DashboardFoundation';

type LaunchPhase = 'launch' | 'transitioning' | 'dashboard';

/**
 * MISSION Master View Controller
 * Deterministic launch sequence: plays cinematic opening screen for 3.5s (or on tap skip),
 * then transitions smoothly into the full-viewport DashboardFoundation.
 */
export const OpeningScreen: React.FC = () => {
  const [launchPhase, setLaunchPhase] = useState<LaunchPhase>('launch');
  const hasTransitionedRef = useRef(false);
  const launchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Deterministic transition trigger (fires automatically or on tap skip)
  const triggerDashboardTransition = useCallback(() => {
    if (hasTransitionedRef.current) return;
    hasTransitionedRef.current = true;

    // Clear auto launch timer
    if (launchTimerRef.current) {
      clearTimeout(launchTimerRef.current);
      launchTimerRef.current = null;
    }

    // Step 1: Smooth fade out launch screen
    setLaunchPhase('transitioning');

    // Step 2: Render full-bleed dashboard foundation after crossfade
    fadeTimerRef.current = setTimeout(() => {
      setLaunchPhase('dashboard');
    }, 800);
  }, []);

  // Automatic launch sequence timer (3.5s duration)
  useEffect(() => {
    launchTimerRef.current = setTimeout(() => {
      triggerDashboardTransition();
    }, 3500);

    return () => {
      if (launchTimerRef.current) clearTimeout(launchTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [triggerDashboardTransition]);

  return (
    <div className="relative w-full h-full min-h-screen bg-black text-white overflow-hidden select-none">
      <AnimatePresence mode="wait">
        {launchPhase !== 'dashboard' ? (
          <motion.div
            key="launch-viewport"
            initial={{ opacity: 1 }}
            animate={{ opacity: launchPhase === 'transitioning' ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-20 w-full h-full min-h-screen cursor-pointer bg-black"
            onClick={triggerDashboardTransition}
            title="Tap to skip directly to dashboard"
          >
            <CinematicLaunchScreen />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard-viewport"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full min-h-screen bg-[#050507]"
          >
            <DashboardFoundation />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

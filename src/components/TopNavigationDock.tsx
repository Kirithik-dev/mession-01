import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Home, Clock, Image, Disc, Settings } from 'lucide-react';
import { TabId } from '../types/mission';

interface TopNavigationDockProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

interface NavItem {
  id: TabId;
  label: string;
  icon: React.FC<{ className?: string; strokeWidth?: number }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'clock', label: 'Clock', icon: Clock },
  { id: 'images', label: 'Images', icon: Image },
  { id: 'phonk', label: 'Phonk', icon: Disc },
  { id: 'settings', label: 'Settings', icon: Settings },
];

/**
 * MISSION Cinematic Floating Bottom Navigation
 * Refined Champagne-Bronze Gold Edition (Icon-Only):
 * - Core highlight: #F5D89A
 * - Main gold: #C9A15B
 * - Ambient glow: #A77B3B
 * - Outer fade: rgba(167, 123, 59, 0)
 * - Minimal icon-only presentation with vertically centered icons
 * - Downward-spreading trapezoidal spotlight attached to top border
 * - Active icon glowing in refined champagne gold, inactive icons in muted grey
 */
export const TopNavigationDock: React.FC<TopNavigationDockProps> = ({
  activeTab,
  onTabChange,
}) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  const activeIndex = Math.max(
    0,
    NAV_ITEMS.findIndex((item) => item.id === activeTab)
  );

  // Synchronized smooth ease transition
  const transitionConfig = prefersReducedMotion
    ? { duration: 0.12 }
    : {
        duration: 0.36,
        ease: [0.16, 1, 0.3, 1] as const,
      };

  return (
    <nav
      aria-label="Primary Bottom Navigation"
      className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 select-none overflow-visible pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="relative w-[370px] sm:w-[410px] max-w-[calc(100vw-24px)] h-[64px] sm:h-[68px]">
        {/* ===================================================================
            LAYER 1: PILL BACKGROUND & CLIPPED CHAMPAGNE-BRONZE TRAPEZOIDAL BEAM
            - Rounded pill with dark charcoal glass surface and subtle border
            - Overflow-hidden so the downward beam is clipped by the pill's bottom curve
           =================================================================== */}
        <div className="absolute inset-0 bg-[#121215]/95 backdrop-blur-2xl rounded-full border border-white/[0.09] shadow-[0_16px_40px_rgba(0,0,0,0.92)] overflow-hidden pointer-events-none">
          {/* Inner Grid Track for Spotlight Beam */}
          <div className="relative w-full h-full px-3.5 sm:px-4">
            <motion.div
              initial={false}
              animate={{ x: `${activeIndex * 100}%` }}
              transition={transitionConfig}
              className="relative w-1/5 h-full pointer-events-none"
            >
              {/* Broad Downward-Spreading Trapezoidal Spotlight Beam */}
              <svg
                viewBox="0 0 80 68"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full overflow-visible"
                fill="none"
              >
                <defs>
                  {/* Outer Trapezoid Vertical Gradient (Core #F5D89A -> Main #C9A15B -> Ambient #A77B3B -> Fade) */}
                  <linearGradient
                    id="missionGoldBeamOuterGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="68"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="#F5D89A" stopOpacity="0.48" />
                    <stop offset="20%" stopColor="#C9A15B" stopOpacity="0.32" />
                    <stop offset="48%" stopColor="#A77B3B" stopOpacity="0.16" />
                    <stop offset="75%" stopColor="#A77B3B" stopOpacity="0.05" />
                    <stop offset="95%" stopColor="#A77B3B" stopOpacity="0" />
                    <stop offset="100%" stopColor="#A77B3B" stopOpacity="0" />
                  </linearGradient>

                  {/* Inner Concentrated Core Gradient for Volumetric Depth */}
                  <linearGradient
                    id="missionGoldBeamCoreGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="68"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="#F5D89A" stopOpacity="0.65" />
                    <stop offset="18%" stopColor="#F5D89A" stopOpacity="0.45" />
                    <stop offset="40%" stopColor="#C9A15B" stopOpacity="0.22" />
                    <stop offset="68%" stopColor="#A77B3B" stopOpacity="0.07" />
                    <stop offset="92%" stopColor="#A77B3B" stopOpacity="0" />
                    <stop offset="100%" stopColor="#A77B3B" stopOpacity="0" />
                  </linearGradient>

                  {/* Soft Radial Ambient Dispenser right below emitter */}
                  <radialGradient
                    id="missionGoldBeamTopBloom"
                    cx="40"
                    cy="0"
                    r="30"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="#F5D89A" stopOpacity="0.55" />
                    <stop offset="35%" stopColor="#C9A15B" stopOpacity="0.28" />
                    <stop offset="70%" stopColor="#A77B3B" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#A77B3B" stopOpacity="0" />
                  </radialGradient>

                  {/* Gaussian Feather Filters for Soft Beam Boundaries */}
                  <filter
                    id="missionGoldBeamFeatherOuter"
                    x="-25%"
                    y="-25%"
                    width="150%"
                    height="150%"
                  >
                    <feGaussianBlur stdDeviation="2.4" />
                  </filter>

                  <filter
                    id="missionGoldBeamFeatherCore"
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                  >
                    <feGaussianBlur stdDeviation="1.8" />
                  </filter>
                </defs>

                {/* Ambient dispenser bloom directly beneath the emitter */}
                <ellipse
                  cx="40"
                  cy="2"
                  rx="22"
                  ry="8"
                  fill="url(#missionGoldBeamTopBloom)"
                  filter="url(#missionGoldBeamFeatherOuter)"
                />

                {/* Outer Broad Downward-Widening Trapezoid */}
                {/* Top width: from x=24 to x=56 (width 32)
                    Bottom width: from x=4 to x=76 (width 72) */}
                <path
                  d="M 24 0 L 56 0 L 76 68 L 4 68 Z"
                  fill="url(#missionGoldBeamOuterGrad)"
                  filter="url(#missionGoldBeamFeatherOuter)"
                />

                {/* Inner Core Trapezoid */}
                {/* Top width: from x=29 to x=51 (width 22)
                    Bottom width: from x=16 to x=64 (width 48) */}
                <path
                  d="M 29 0 L 51 0 L 64 68 L 16 68 Z"
                  fill="url(#missionGoldBeamCoreGrad)"
                  filter="url(#missionGoldBeamFeatherCore)"
                />
              </svg>
            </motion.div>
          </div>
        </div>

        {/* ===================================================================
            LAYER 2: TOP EMITTER FIXTURE (CHAMPAGNE-BRONZE LAMP AT TOP BORDER)
            - Sits directly on the top border of the pill above the active item
            - Unclipped so its rounded top cap and warm atmospheric bloom are crisp
            - Synchronized in lockstep with the beam
           =================================================================== */}
        <div className="absolute inset-0 px-3.5 sm:px-4 pointer-events-none z-20 overflow-visible">
          <motion.div
            initial={false}
            animate={{ x: `${activeIndex * 100}%` }}
            transition={transitionConfig}
            className="relative w-1/5 h-full flex justify-center pointer-events-none"
          >
            <div className="absolute -top-[2px] flex flex-col items-center">
              {/* Soft warm champagne-gold atmospheric bloom around the lamp */}
              <div className="absolute -top-1 w-11 h-3.5 bg-[#C9A15B]/30 blur-[3px] rounded-full pointer-events-none" />
              <div className="absolute -top-0.5 w-7 h-2 bg-[#F5D89A]/40 blur-[2px] rounded-full pointer-events-none" />
              {/* Physical lamp fixture bar embedded in the top border */}
              <div className="w-8 sm:w-9 h-[4px] bg-[#F5D89A] rounded-full shadow-[0_0_6px_rgba(201,161,91,0.8),0_0_2px_rgba(245,216,154,0.9),0_1px_2px_rgba(0,0,0,0.6)]" />
            </div>
          </motion.div>
        </div>

        {/* ===================================================================
            LAYER 3: INTERACTIVE NAVIGATION TABS (5 ITEMS, ICON-ONLY)
            - Vertically centered inside the pill
            - Selected icon glows in refined champagne gold (#F5D89A)
            - Inactive icons remain subdued grey
            - Generous, equal-sized touch targets (>= 44x44px)
           =================================================================== */}
        <div className="relative z-30 grid grid-cols-5 items-center w-full h-full px-3.5 sm:px-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                title={item.label}
                className="group relative flex items-center justify-center w-full h-full cursor-pointer select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A15B]/50"
              >
                <motion.span
                  initial={false}
                  animate={{
                    scale: isActive ? 1.08 : 1,
                    y: isActive ? -0.5 : 0,
                  }}
                  whileHover={prefersReducedMotion ? undefined : { y: -1.5 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex items-center justify-center transition-colors duration-250 ${
                    isActive
                      ? 'text-[#F5D89A]'
                      : 'text-white/40 group-hover:text-white/70'
                  }`}
                  style={{
                    filter: isActive
                      ? 'drop-shadow(0 0 5px rgba(201, 161, 91, 0.5)) drop-shadow(0 0 10px rgba(167, 123, 59, 0.22))'
                      : 'none',
                  }}
                >
                  <Icon
                    className="w-[21px] h-[21px] sm:w-[22px] sm:h-[22px]"
                    strokeWidth={isActive ? 2.1 : 1.75}
                  />
                </motion.span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

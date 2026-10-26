import React from 'react';

interface HangingIndustrialLampProps {
  isOn: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * HangingIndustrialLamp Component
 * Minimal industrial pendant lamp (matching Reference 2):
 * - Thin vertical hanging wire extends all the way to the top edge of the Clock tab
 * - Small understated dark-metal socket collar
 * - Smooth, shallow dome metal shade in matte charcoal graphite (#1c1e23 - #2e3038)
 * - Tiny exposed frosted white bulb centered beneath the shade rim
 * - Atmospheric warm downward diffuse light cone when ON
 * - Completely unlit dark pendant against near-black canvas when OFF
 * - Tap to toggle master alarm state
 */
export const HangingIndustrialLamp: React.FC<HangingIndustrialLampProps> = ({
  isOn,
  onToggle,
  className = '',
}) => {
  return (
    <div
      className={`relative w-full flex flex-col items-center justify-start select-none ${className}`}
    >
      {/* ===================================================================
          LAYER 0: VOLUMETRIC DOWNWARD DIFFUSE LIGHT CONE
          Soft, cinematic warm champagne-white falloff.
          Only visible when isOn === true.
         =================================================================== */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute top-[95px] left-1/2 -translate-x-1/2 w-[92vw] max-w-[500px] h-[260px] sm:h-[300px] transition-opacity duration-500 ease-out z-0 ${
          isOn ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <svg
          viewBox="0 0 500 300"
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
        >
          <defs>
            {/* Soft Downward Diffuse Beam Gradient (Warm White / Pale Champagne) */}
            <linearGradient
              id="lampBeamVertGrad"
              x1="250"
              y1="0"
              x2="250"
              y2="300"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#FFFDF7" stopOpacity="0.26" />
              <stop offset="16%" stopColor="#FAF2E1" stopOpacity="0.16" />
              <stop offset="38%" stopColor="#F2DFC2" stopOpacity="0.08" />
              <stop offset="68%" stopColor="#D9B77C" stopOpacity="0.025" />
              <stop offset="92%" stopColor="#9E7632" stopOpacity="0.005" />
              <stop offset="100%" stopColor="#050507" stopOpacity="0" />
            </linearGradient>

            {/* Lateral Edge Softness Mask for Atmospheric Falloff */}
            <linearGradient
              id="lampBeamHMask"
              x1="0"
              y1="0"
              x2="500"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#000000" stopOpacity="0" />
              <stop offset="20%" stopColor="#FFFFFF" stopOpacity="0.5" />
              <stop offset="40%" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="60%" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="80%" stopColor="#FFFFFF" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </linearGradient>

            <mask id="lampBeamMask">
              <rect
                x="0"
                y="0"
                width="500"
                height="300"
                fill="url(#lampBeamHMask)"
              />
            </mask>

            {/* Bulb Direct Emitter Bloom */}
            <radialGradient
              id="lampBulbBloom"
              cx="250"
              cy="2"
              r="120"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
              <stop offset="22%" stopColor="#FFF7E6" stopOpacity="0.22" />
              <stop offset="55%" stopColor="#FCE3AA" stopOpacity="0.07" />
              <stop offset="100%" stopColor="#E2B155" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Diffuse Outer Cone */}
          <polygon
            points="190,0 310,0 460,300 40,300"
            fill="url(#lampBeamVertGrad)"
            mask="url(#lampBeamMask)"
            style={{ filter: 'blur(20px)' }}
          />

          {/* Concentrated Inner Glow Core */}
          <polygon
            points="220,0 280,0 370,300 130,300"
            fill="url(#lampBeamVertGrad)"
            mask="url(#lampBeamMask)"
            style={{ filter: 'blur(12px)', opacity: 0.85 }}
          />

          {/* Immediate Bulb Ambient Halo */}
          <ellipse
            cx="250"
            cy="8"
            rx="90"
            ry="38"
            fill="url(#lampBulbBloom)"
            style={{ filter: 'blur(8px)' }}
          />
        </svg>

        {/* Floor ambient pool softly illuminating negative space */}
        <div
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[80%] h-[70px] rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 65% 50% at 50% 50%, rgba(255, 250, 240, 0.07) 0%, rgba(245, 214, 140, 0.015) 50%, transparent 80%)',
            filter: 'blur(16px)',
          }}
        />
      </div>

      {/* ===================================================================
          LAYER 1: MINIMAL INDUSTRIAL PENDANT LAMP (SVG VECTOR)
          Wire extends all the way to the top edge (y=0)
          Shallow curved dome shade in matte dark charcoal (#1e2025)
          Tiny exposed white frosted bulb
         =================================================================== */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        title={`Alarm is ${isOn ? 'On (Illuminated)' : 'Off (Unlit)'} · Tap lamp to toggle`}
        aria-label={`Alarm is currently ${isOn ? 'enabled' : 'disabled'}. Tap lamp to toggle.`}
        className="relative z-10 w-[240px] sm:w-[280px] h-[125px] sm:h-[135px] cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[#F5CE76]/40 transition-transform duration-200 active:scale-[0.99]"
      >
        <svg
          viewBox="0 0 280 135"
          className="w-full h-full overflow-visible drop-shadow-[0_8px_18px_rgba(0,0,0,0.85)]"
        >
          <defs>
            {/* 1. Thin Black Hanging Wire Gradient */}
            <linearGradient id="lampWireGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0B0C0E" />
              <stop offset="50%" stopColor="#22252C" />
              <stop offset="100%" stopColor="#090A0C" />
            </linearGradient>

            {/* 2. Socket Collar Gradient */}
            <linearGradient id="lampSocketGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#15161A" />
              <stop offset="35%" stopColor="#2E3038" />
              <stop offset="65%" stopColor="#2A2C33" />
              <stop offset="100%" stopColor="#121316" />
            </linearGradient>

            {/* 3. Matte Charcoal Dome Shade Gradient */}
            <radialGradient
              id="lampDomeMatteGrad"
              cx="140"
              cy="48"
              r="105"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#2E3038" />
              <stop offset="32%" stopColor="#25272E" />
              <stop offset="68%" stopColor="#1C1E23" />
              <stop offset="100%" stopColor="#121317" />
            </radialGradient>

            {/* 4. Subtle Ambient Vertical Overlay for Curvature Depth */}
            <linearGradient id="lampDomeVerticalOverlay" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.06" />
              <stop offset="35%" stopColor="#000000" stopOpacity="0" />
              <stop offset="85%" stopColor="#000000" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.04" />
            </linearGradient>

            {/* 5. Underside Shade Cavity - Dark when OFF */}
            <radialGradient
              id="lampInnerCavityOff"
              cx="140"
              cy="100"
              rx="90"
              ry="7"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#26282F" />
              <stop offset="60%" stopColor="#17181D" />
              <stop offset="100%" stopColor="#0D0E11" />
            </radialGradient>

            {/* 6. Underside Shade Cavity - Ambient Warmth when ON */}
            <radialGradient
              id="lampInnerCavityOn"
              cx="140"
              cy="100"
              rx="90"
              ry="7"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#4A4134" />
              <stop offset="45%" stopColor="#2F2921" />
              <stop offset="85%" stopColor="#1B1713" />
              <stop offset="100%" stopColor="#0F0D0B" />
            </radialGradient>

            {/* 7. Frosted Bulb - ON State */}
            <radialGradient
              id="lampBulbOnGrad"
              cx="140"
              cy="104"
              r="10"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="35%" stopColor="#FFFDF7" />
              <stop offset="70%" stopColor="#FFF2D6" />
              <stop offset="100%" stopColor="#F9DF9C" />
            </radialGradient>

            {/* 8. Frosted Bulb - OFF State */}
            <radialGradient
              id="lampBulbOffGrad"
              cx="140"
              cy="104"
              r="10"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#3C3F47" />
              <stop offset="55%" stopColor="#272930" />
              <stop offset="100%" stopColor="#181A1F" />
            </radialGradient>

            {/* 9. Bulb Soft Glow Filter */}
            <filter id="lampBulbSoftGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ===============================================================
              PART A: THIN HANGING WIRE DESCENDING ALL THE WAY FROM TOP (y=0 to 38)
             =============================================================== */}
          <rect
            x="139.3"
            y="0"
            width="1.4"
            height="38"
            fill="url(#lampWireGrad)"
          />
          <line
            x1="139.8"
            y1="0"
            x2="139.8"
            y2="38"
            stroke="#363944"
            strokeWidth="0.4"
            opacity="0.5"
          />

          {/* ===============================================================
              PART B: UNDERSTATED SOCKET COLLAR (y=38 to 43)
             =============================================================== */}
          <rect
            x="137.2"
            y="38"
            width="5.6"
            height="5"
            rx="0.8"
            fill="url(#lampSocketGrad)"
            stroke="#262830"
            strokeWidth="0.5"
          />

          {/* ===============================================================
              PART C: SHALLOW DOME SHADE SILHOUETTE
              - Apex starts at (140, 43)
              - Curves smoothly down to (50, 100) and (230, 100)
             =============================================================== */}
          <path
            d="M 50 100
               C 74 62, 114 43, 140 43
               C 166 43, 206 62, 230 100
               C 195 106, 85 106, 50 100
               Z"
            fill="url(#lampDomeMatteGrad)"
          />

          <path
            d="M 50 100
               C 74 62, 114 43, 140 43
               C 166 43, 206 62, 230 100
               C 195 106, 85 106, 50 100
               Z"
            fill="url(#lampDomeVerticalOverlay)"
          />

          {/* ===============================================================
              PART D: UNDERSIDE SHADE OPENING
             =============================================================== */}
          <ellipse
            cx="140"
            cy="100"
            rx="90"
            ry="6"
            fill="url(#lampInnerCavityOff)"
            className={`transition-opacity duration-500 ease-out ${
              isOn ? 'opacity-0' : 'opacity-100'
            }`}
          />

          <ellipse
            cx="140"
            cy="100"
            rx="90"
            ry="6"
            fill="url(#lampInnerCavityOn)"
            className={`transition-opacity duration-500 ease-out ${
              isOn ? 'opacity-100' : 'opacity-0'
            }`}
          />

          <ellipse
            cx="140"
            cy="100"
            rx="90"
            ry="6"
            fill="none"
            stroke="#24262D"
            strokeWidth="0.7"
            opacity="0.85"
          />

          {/* ===============================================================
              PART E: TINY EXPOSED FROSTED BULB
             =============================================================== */}
          {/* Bulb - OFF State */}
          <g
            className={`transition-opacity duration-500 ease-out ${
              isOn ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <circle
              cx="140"
              cy="104"
              r="9.5"
              fill="url(#lampBulbOffGrad)"
              stroke="#262830"
              strokeWidth="0.5"
            />
            <path
              d="M 136 100 C 134 103, 134 107, 137 109"
              fill="none"
              stroke="#525663"
              strokeWidth="0.65"
              strokeLinecap="round"
              opacity="0.4"
            />
          </g>

          {/* Bulb - ON State */}
          <g
            className={`transition-opacity duration-500 ease-out ${
              isOn ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <circle
              cx="140"
              cy="104"
              r="15"
              fill="#FFF8E7"
              opacity="0.38"
              style={{ filter: 'blur(4px)' }}
            />
            <circle
              cx="140"
              cy="104"
              r="9.5"
              fill="url(#lampBulbOnGrad)"
              filter="url(#lampBulbSoftGlow)"
            />
            <circle
              cx="140"
              cy="104"
              r="4"
              fill="#FFFFFF"
              opacity="0.9"
            />
          </g>
        </svg>

        {/* Ambient bottom rim warm flare when ON */}
        <div
          className={`absolute bottom-3 left-1/2 -translate-x-1/2 w-32 h-2 rounded-full pointer-events-none transition-opacity duration-500 ${
            isOn ? 'opacity-80' : 'opacity-0'
          }`}
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255, 252, 245, 0.7) 0%, rgba(250, 226, 170, 0.25) 45%, transparent 80%)',
            filter: 'blur(3px)',
          }}
        />
      </div>
    </div>
  );
};

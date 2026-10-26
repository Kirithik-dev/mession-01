import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HomeMusicPlayerCard } from './HomeMusicPlayerCard';

interface Point {
  u: number;
  v: number;
}

interface GlyphData {
  points: Point[];
}

type SlotKey = 'h1' | 'h2' | 'colon' | 'm1' | 'm2' | 'colonSec' | 's1' | 's2';

interface Particle {
  slot: SlotKey;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  midX: number;
  midY: number;
  vx: number;
  vy: number;
  radius: number;
  baseOpacity: number;
  opacity: number;
  colorType: 'silver' | 'highlight' | 'gold';
  colorRgb: string;
  isGold: boolean;
  isMorphing: boolean;
  morphStart: number;
  morphDuration: number;
  ambientPhase: number;
  ambientFreq: number;
}

interface SlotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GLYPH_CACHE = new Map<string, GlyphData>();

/**
 * Samples a character glyph into normalized [0, 1] points using an offscreen canvas
 */
function getGlyphPoints(char: string): Point[] {
  if (GLYPH_CACHE.has(char)) {
    return GLYPH_CACHE.get(char)!.points;
  }

  const canvas = document.createElement('canvas');
  const w = 120;
  const h = 160;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 124px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, w / 2, h / 2);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const points: Point[] = [];
  const step = 3;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const idx = (y * w + x) * 4;
      const alpha = data[idx + 3];
      if (alpha > 70) {
        points.push({
          u: (x + (Math.random() - 0.5) * 1.5) / w,
          v: (y + (Math.random() - 0.5) * 1.5) / h,
        });
      }
    }
  }

  GLYPH_CACHE.set(char, { points });
  return points;
}

const SLOT_COUNTS: Record<SlotKey, number> = {
  h1: 340,
  h2: 440,
  colon: 100,
  m1: 440,
  m2: 440,
  colonSec: 60,
  s1: 220,
  s2: 260,
};

/**
 * Formats current date dynamically as "MONDAY, OCTOBER 26"
 */
function getFormattedDate(): string {
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const month = now.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
  const day = now.getDate();
  return `${weekday}, ${month} ${day}`;
}

/**
 * CHRONOS Particle Clock
 * - Positioned substantially upward (~100-120px higher) in the upper quarter of the screen
 * - Status bar safe-area clearance strictly guaranteed
 * - Date restored dynamically beneath the time in "MONDAY, OCTOBER 26" format with #858585 styling
 * - Silver-white particles with sparse champagne-gold accents (#C9A15B)
 * - Fluid quadratic Bezier morphing on changed digits
 */
export const ChronosParticleClock: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const safeTopProbeRef = useRef<HTMLDivElement | null>(null);

  // Synchronously initialize with formatted local date (never blank)
  const [dateString, setDateString] = useState<string>(getFormattedDate);
  const [dateTopPx, setDateTopPx] = useState<number>(165);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Engine state references
  const particlesRef = useRef<Particle[]>([]);
  const prevDigitsRef = useRef<Record<SlotKey, string>>({
    h1: '',
    h2: '',
    colon: ':',
    m1: '',
    m2: '',
    colonSec: ':',
    s1: '',
    s2: '',
  });
  const slotsRef = useRef<Record<SlotKey, SlotRect>>({
    h1: { x: 0, y: 0, w: 0, h: 0 },
    h2: { x: 0, y: 0, w: 0, h: 0 },
    colon: { x: 0, y: 0, w: 0, h: 0 },
    m1: { x: 0, y: 0, w: 0, h: 0 },
    m2: { x: 0, y: 0, w: 0, h: 0 },
    colonSec: { x: 0, y: 0, w: 0, h: 0 },
    s1: { x: 0, y: 0, w: 0, h: 0 },
    s2: { x: 0, y: 0, w: 0, h: 0 },
  });

  const animFrameIdRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Update dynamic date string periodically
  useEffect(() => {
    const updateDate = () => {
      setDateString(getFormattedDate());
    };

    updateDate();
    const interval = setInterval(updateDate, 30000);
    return () => clearInterval(interval);
  }, []);

  // Layout slots inside canvas: positioned substantially upward (~100-120px higher) while respecting safe-area inset
  const computeSlotLayout = useCallback((w: number, h: number) => {
    const isMobile = w < 640;
    const maxDigitH = isMobile ? Math.min(78, w * 0.18) : Math.min(125, h * 0.19, w * 0.14);
    const mainH = maxDigitH;
    const mainW = mainH * 0.60;
    const colonW = mainH * 0.22;
    const gap = mainH * 0.10;

    const secH = mainH * 0.50;
    const secW = secH * 0.60;
    const colonSecW = secH * 0.20;
    const secGap = secH * 0.10;

    const mainGroupWidth = mainW * 4 + colonW + gap * 4;
    const secGroupWidth = secW * 2 + colonSecW + secGap * 2;
    const groupGap = isMobile ? 10 : 16;
    const totalClockWidth = mainGroupWidth + groupGap + secGroupWidth;

    const startX = (w - totalClockWidth) / 2;

    // Dynamically measure top safe-area inset for notches and OS status bar
    const measuredSafeTop = safeTopProbeRef.current
      ? parseFloat(window.getComputedStyle(safeTopProbeRef.current).paddingTop) || 0
      : 0;
    // Status bar clearance: safe area inset or minimum 24px (mobile)
    const effectiveSafeTop = Math.max(measuredSafeTop, isMobile ? 24 : 0);

    // Substantial upward shift: position time display in the upper quarter of the screen,
    // moving it upward by ~100-120px from previous positions while guaranteeing at least 22px
    // clear buffer below the phone's status bar icons.
    const minMainTopY = effectiveSafeTop + (isMobile ? 22 : 30);
    const minCenterY = minMainTopY + mainH / 2;

    // Center of time digits sits in the upper quarter of usable space (~105-115px on mobile)
    const targetCenterY = isMobile
      ? Math.max(minCenterY, Math.round(effectiveSafeTop + 24 + mainH / 2))
      : Math.max(minCenterY, Math.round(effectiveSafeTop + 36 + mainH / 2));

    const centerY = targetCenterY;
    const mainTopY = centerY - mainH / 2;
    const secTopY = centerY + mainH / 2 - secH - (isMobile ? 2 : 4);

    let curX = startX;

    // H1
    const h1: SlotRect = { x: curX, y: mainTopY, w: mainW, h: mainH };
    curX += mainW + gap;

    // H2
    const h2: SlotRect = { x: curX, y: mainTopY, w: mainW, h: mainH };
    curX += mainW + gap;

    // Colon
    const colon: SlotRect = { x: curX, y: mainTopY, w: colonW, h: mainH };
    curX += colonW + gap;

    // M1
    const m1: SlotRect = { x: curX, y: mainTopY, w: mainW, h: mainH };
    curX += mainW + gap;

    // M2
    const m2: SlotRect = { x: curX, y: mainTopY, w: mainW, h: mainH };
    curX += mainW + groupGap;

    // ColonSec
    const colonSec: SlotRect = { x: curX, y: secTopY, w: colonSecW, h: secH };
    curX += colonSecW + secGap;

    // S1
    const s1: SlotRect = { x: curX, y: secTopY, w: secW, h: secH };
    curX += secW + secGap;

    // S2
    const s2: SlotRect = { x: curX, y: secTopY, w: secW, h: secH };

    slotsRef.current = { h1, h2, colon, m1, m2, colonSec, s1, s2 };

    // Position date directly beneath the main digits: exactly 22-26px below the time digits
    const dateTop = Math.round(centerY + mainH / 2 + (isMobile ? 22 : 26));
    setDateTopPx(dateTop);
  }, []);

  // Initialize particles pool once (forming only the time digits)
  const initParticles = useCallback((w: number, h: number) => {
    const list: Particle[] = [];
    const slots = (Object.keys(SLOT_COUNTS) as SlotKey[]);

    slots.forEach((slot) => {
      const count = SLOT_COUNTS[slot];
      for (let i = 0; i < count; i++) {
        const rand = Math.random();
        let colorType: 'silver' | 'highlight' | 'gold' = 'silver';
        let colorRgb = '218, 221, 226'; // #DADDE2
        let isGold = false;

        if (rand > 0.92) {
          colorType = 'gold';
          colorRgb = '201, 161, 91'; // #C9A15B
          isGold = true;
        } else if (rand > 0.72) {
          colorType = 'highlight';
          colorRgb = '245, 245, 242'; // #F5F5F2
        }

        const baseOpacity = isGold
          ? 0.75 + Math.random() * 0.25
          : colorType === 'highlight'
          ? 0.85 + Math.random() * 0.15
          : 0.65 + Math.random() * 0.25;

        const radius = isGold
          ? 1.4 + Math.random() * 0.6
          : colorType === 'highlight'
          ? 1.3 + Math.random() * 0.6
          : 1.1 + Math.random() * 0.5;

        list.push({
          slot,
          x: w / 2 + (Math.random() - 0.5) * w * 0.4,
          y: 110 + (Math.random() - 0.5) * 60,
          startX: 0,
          startY: 0,
          targetX: 0,
          targetY: 0,
          midX: 0,
          midY: 0,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          radius,
          baseOpacity,
          opacity: baseOpacity,
          colorType,
          colorRgb,
          isGold,
          isMorphing: false,
          morphStart: 0,
          morphDuration: 420,
          ambientPhase: Math.random() * Math.PI * 2,
          ambientFreq: 0.0018 + Math.random() * 0.002,
        });
      }
    });

    particlesRef.current = list;
    isInitializedRef.current = true;
  }, []);

  // Morph a specific slot to a new character glyph
  const morphSlot = useCallback((slot: SlotKey, char: string, nowTime: number, isInitial: boolean) => {
    const slotRect = slotsRef.current[slot];
    if (!slotRect || slotRect.w === 0) return;

    const points = getGlyphPoints(char);
    if (points.length === 0) return;

    const particles = particlesRef.current.filter((p) => p.slot === slot);
    const numParticles = particles.length;

    for (let i = 0; i < numParticles; i++) {
      const p = particles[i];
      const ptIdx = Math.floor((i / numParticles) * points.length);
      const pt = points[ptIdx] || points[i % points.length];

      const scatterX = (Math.random() - 0.5) * 2.0;
      const scatterY = (Math.random() - 0.5) * 2.0;

      const newTargetX = slotRect.x + pt.u * slotRect.w + scatterX;
      const newTargetY = slotRect.y + pt.v * slotRect.h + scatterY;

      if (isInitial) {
        p.x = newTargetX;
        p.y = newTargetY;
        p.targetX = newTargetX;
        p.targetY = newTargetY;
        p.isMorphing = false;
      } else {
        p.startX = p.x;
        p.startY = p.y;
        p.targetX = newTargetX;
        p.targetY = newTargetY;

        const dx = newTargetX - p.startX;
        const dy = newTargetY - p.startY;
        const dist = Math.hypot(dx, dy);

        const perpX = dist > 0 ? -dy / dist : 0;
        const perpY = dist > 0 ? dx / dist : 0;
        const curvature = (Math.random() - 0.5) * Math.min(dist * 0.7, 32);

        p.midX = (p.startX + newTargetX) / 2 + perpX * curvature + (Math.random() - 0.5) * 12;
        p.midY = (p.startY + newTargetY) / 2 + perpY * curvature + (Math.random() - 0.5) * 12;

        p.isMorphing = true;
        p.morphStart = nowTime;
        p.morphDuration = 380 + Math.random() * 140;
      }
    }
  }, []);

  // Main animation frame loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    computeSlotLayout(width, height);
    if (!isInitializedRef.current) {
      initParticles(width, height);
    }

    // Force initial placement of all digits
    const initialDate = new Date();
    const h = initialDate.getHours();
    const m = initialDate.getMinutes();
    const s = initialDate.getSeconds();

    const curDigits: Record<SlotKey, string> = {
      h1: Math.floor(h / 10).toString(),
      h2: (h % 10).toString(),
      colon: ':',
      m1: Math.floor(m / 10).toString(),
      m2: (m % 10).toString(),
      colonSec: ':',
      s1: Math.floor(s / 10).toString(),
      s2: (s % 10).toString(),
    };

    (Object.keys(curDigits) as SlotKey[]).forEach((slot) => {
      morphSlot(slot, curDigits[slot], performance.now(), true);
      prevDigitsRef.current[slot] = curDigits[slot];
    });

    let running = true;

    const render = (time: number) => {
      if (!running) return;

      const now = new Date();
      const hours = now.getHours();
      const mins = now.getMinutes();
      const secs = now.getSeconds();

      const newDigits: Record<SlotKey, string> = {
        h1: Math.floor(hours / 10).toString(),
        h2: (hours % 10).toString(),
        colon: ':',
        m1: Math.floor(mins / 10).toString(),
        m2: (mins % 10).toString(),
        colonSec: ':',
        s1: Math.floor(secs / 10).toString(),
        s2: (secs % 10).toString(),
      };

      (Object.keys(newDigits) as SlotKey[]).forEach((slot) => {
        if (newDigits[slot] !== prevDigitsRef.current[slot]) {
          morphSlot(slot, newDigits[slot], time, prefersReducedMotion);
          prevDigitsRef.current[slot] = newDigits[slot];
        }
      });

      // Clear canvas cleanly
      ctx.clearRect(0, 0, width, height);

      const particles = particlesRef.current;
      const pLen = particles.length;

      // Update & render digit particles
      for (let i = 0; i < pLen; i++) {
        const p = particles[i];

        if (p.isMorphing) {
          const elapsed = time - p.morphStart;
          const t = Math.min(1, Math.max(0, elapsed / p.morphDuration));
          const ease = 1 - Math.pow(1 - t, 3);

          const oneMinusT = 1 - ease;
          p.x = oneMinusT * oneMinusT * p.startX + 2 * oneMinusT * ease * p.midX + ease * ease * p.targetX;
          p.y = oneMinusT * oneMinusT * p.startY + 2 * oneMinusT * ease * p.midY + ease * ease * p.targetY;
          p.opacity = p.baseOpacity * (1 + 0.15 * Math.sin(t * Math.PI));

          if (t >= 1) {
            p.isMorphing = false;
            p.x = p.targetX;
            p.y = p.targetY;
          }
        } else {
          // Stationary ambient micro-drift / shimmer
          const phase = time * p.ambientFreq + p.ambientPhase;
          const microX = Math.sin(phase) * 0.45;
          const microY = Math.cos(phase * 1.3) * 0.45;

          p.x = p.targetX + microX;
          p.y = p.targetY + microY;

          let op = p.baseOpacity * (0.88 + 0.12 * Math.sin(phase * 1.6));
          if (p.isGold) {
            const glint = Math.max(0, Math.sin(time * 0.003 + p.ambientPhase * 3) - 0.75) / 0.25;
            op = Math.min(1, op + glint * 0.35);
          }
          p.opacity = op;
        }

        ctx.fillStyle = `rgba(${p.colorRgb}, ${p.opacity.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    const handleResize = () => {
      if (!container || !canvas) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.scale(dpr, dpr);

      computeSlotLayout(width, height);

      (Object.keys(prevDigitsRef.current) as SlotKey[]).forEach((slot) => {
        morphSlot(slot, prevDigitsRef.current[slot], performance.now(), true);
      });
    };

    window.addEventListener('resize', handleResize);

    const handleVisibility = () => {
      if (document.hidden) {
        if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      } else {
        const resumedDate = new Date();
        const rh = resumedDate.getHours();
        const rm = resumedDate.getMinutes();
        const rs = resumedDate.getSeconds();

        const resumedDigits: Record<SlotKey, string> = {
          h1: Math.floor(rh / 10).toString(),
          h2: (rh % 10).toString(),
          colon: ':',
          m1: Math.floor(rm / 10).toString(),
          m2: (rm % 10).toString(),
          colonSec: ':',
          s1: Math.floor(rs / 10).toString(),
          s2: (rs % 10).toString(),
        };

        (Object.keys(resumedDigits) as SlotKey[]).forEach((slot) => {
          morphSlot(slot, resumedDigits[slot], performance.now(), true);
          prevDigitsRef.current[slot] = resumedDigits[slot];
        });

        if (running) {
          animFrameIdRef.current = requestAnimationFrame(render);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      running = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [computeSlotLayout, initParticles, morphSlot, prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-screen select-none overflow-hidden"
    >
      {/* Invisible probe element to dynamically measure env(safe-area-inset-top) */}
      <div
        ref={safeTopProbeRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 w-0 h-0 opacity-0 pt-[env(safe-area-inset-top,0px)]"
      />

      {/* Full Canvas for Particle Digits (z-10) */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />
      </div>

      {/* Dynamically Formatted Date immediately below particle clock (z-20) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center select-none"
        style={{ top: `${dateTopPx}px` }}
      >
        <p
          className="text-xs sm:text-[13px] font-mono uppercase whitespace-nowrap tracking-[0.18em]"
          style={{ color: '#858585' }}
        >
          {dateString}
        </p>
      </div>

      {/* Album-Style Music Player Card (z-20, in the space between the date and the bottom navigation dock) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-20 flex flex-col items-center justify-center pointer-events-auto"
        style={{
          top: `${dateTopPx + 24}px`,
          bottom: '96px',
          width: '100%',
          maxWidth: '360px',
          paddingLeft: '16px',
          paddingRight: '16px',
        }}
      >
        <HomeMusicPlayerCard />
      </div>
    </div>
  );
};

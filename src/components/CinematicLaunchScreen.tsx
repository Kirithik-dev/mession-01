import React, { useEffect, useRef, useState } from 'react';
import { Lottie } from 'lottie-react';
import loadingAnimation from '../assets/loading.json';

interface Star {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  phase: number;
  speed: number;
}

interface SmokeCloudNode {
  xRatio: number;
  yRatio: number;
  radius: number;
  phase: number;
  speed: number;
  maxAlpha: number;
}

export const CinematicLaunchScreen: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Detect reduced-motion preferences
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Canvas Motion Engine: Living Smoke Shimmer & Twinkling Stars
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    // 1. Twinkling Star Pool
    const stars: Star[] = [];
    const starCount = prefersReducedMotion ? 40 : 120;
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.5 + 0.4,
        baseAlpha: Math.random() * 0.6 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.015 + Math.random() * 0.03,
      });
    }

    // 2. Billowing Smoke Plume Fluid Shimmer Nodes
    const smokeNodes: SmokeCloudNode[] = [];
    for (let i = 0; i < 18; i++) {
      smokeNodes.push({
        xRatio: 0.48 + (Math.random() - 0.5) * 0.25,
        yRatio: 0.52 + Math.random() * 0.32,
        radius: 22 + Math.random() * 50,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0012 + Math.random() * 0.002,
        maxAlpha: 0.04 + Math.random() * 0.06,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Render 1: Twinkling Star Field
      stars.forEach((star) => {
        if (!prefersReducedMotion) {
          star.phase += star.speed;
        }
        const currentAlpha = star.baseAlpha + Math.sin(star.phase) * 0.25;
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = Math.max(0.05, Math.min(1, currentAlpha));
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render 2: Billowing Smoke Plume Fluid Shimmer
      if (!prefersReducedMotion) {
        smokeNodes.forEach((node) => {
          node.phase += node.speed;
          const nodeX = width * node.xRatio + Math.sin(node.phase) * 8;
          const nodeY = height * node.yRatio + Math.cos(node.phase * 0.7) * 5;
          const currentAlpha = node.maxAlpha * (0.65 + Math.sin(node.phase * 1.8) * 0.35);

          const radGrad = ctx.createRadialGradient(
            nodeX,
            nodeY,
            0,
            nodeX,
            nodeY,
            node.radius * 1.3
          );
          radGrad.addColorStop(0, `rgba(235, 240, 250, ${currentAlpha})`);
          radGrad.addColorStop(0.5, `rgba(175, 185, 200, ${currentAlpha * 0.4})`);
          radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = radGrad;
          ctx.beginPath();
          ctx.arc(nodeX, nodeY, node.radius * 1.3, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [prefersReducedMotion]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center select-none">
      {/* Target Reference Artwork Image: Pure black starfield, silver smoke plume, and single "NEVER STOP!" quote */}
      <div className="relative w-full h-full flex items-center justify-center bg-black">
        <img
          src="/assets/aistudio/image_4d7ac824.png"
          alt="MISSION Launch - NEVER STOP!"
          className="w-full h-full object-contain object-center max-w-full max-h-full filter brightness-105 contrast-105 pointer-events-none"
        />

        {/* Dynamic Canvas Layer for Twinkling Stars & Billowing Smoke Fluid Shimmer */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen opacity-90"
        />

        {/* Continuous Lottie Loading Animation - Positioned bottom center (~28px above bottom, subtle 52px size) */}
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[52px] h-[52px] flex items-center justify-center">
          <Lottie
            src={loadingAnimation}
            loop={true}
            autoplay={true}
            className="w-full h-full object-contain"
          />
        </div>
      </div>
    </div>
  );
};

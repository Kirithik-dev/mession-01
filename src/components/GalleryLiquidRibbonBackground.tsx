import React, { useEffect, useRef } from 'react';

/**
 * MISSION Gallery Liquid Ribbon Background
 * 
 * Recreates the living 3D liquid-ribbon visible in the cinematic reference:
 * - Suspended in pure / midnight black (#0B0B0E / #000000)
 * - 3D fluid S-curve centerline that morphs continuously like silk / liquid mercury in zero gravity
 * - Main ribbon body: deep charcoal with subtle midnight-navy undertones and directional sheen
 * - Illuminated rim: razor-thin silver-white core highlight (~1.2px) with cool blue-violet sheen
 *   and soft volumetric navy ambient glow
 * - Shadows & depth: large portions of the ribbon dissolve into pure darkness as it twists away
 * - Zero scattered dots, stars, glitter, or particle noise
 * - High-performance WebGL renderer with automatic, seamless Canvas2D fallback
 * - Device pixel ratio capped at 2, pointer-events-none, auto-pauses when hidden,
 *   respects prefers-reduced-motion
 */

// --- Vertex Shader Source ---
const VS_SOURCE = `
  attribute float a_u; // Lengthwise parameter [0.0, 1.0]
  attribute float a_v; // Width parameter [-1.0, 1.0]

  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_ribbonId; // 0.0: Primary dominant ribbon, 1.0: Secondary deep echo

  varying vec2 v_uv;
  varying vec3 v_normal;
  varying vec3 v_pos;
  varying float v_pixelWidth;
  varying float v_depthFade;

  // 3D Parametric Centerline of the liquid ribbon
  vec3 getCenterline(float u, float t, float isSecondary) {
    // S-curve vertical sweep from upper area (+1.3) to lower area (-1.3)
    float py = (0.5 - u) * 2.5;

    // Phase offsets for the secondary undercurrent ribbon
    float pOff = isSecondary * 1.75;
    float tRate = isSecondary > 0.5 ? 0.75 : 1.0;
    float curT = t * tRate + pOff;

    // Harmonic S-curve wave displacement
    float s1 = sin(u * 3.14159265 * 1.85 - 0.2 + curT * 0.35);
    float s2 = sin(u * 3.14159265 * 3.7 + curT * 0.5);
    float s3 = cos(u * 3.14159265 * 5.6 - curT * 0.3);

    float ampX = isSecondary > 0.5 ? 0.52 : 0.64;
    float px = s1 * ampX + s2 * 0.12 + s3 * 0.04;

    // Continuous undulating fluid breathing
    px += sin(u * 3.0 - curT * 0.42) * 0.14;
    py += cos(u * 3.4 + curT * 0.32) * 0.08;

    // 3D Depth curve: swoops toward camera then dives back into deep shadow
    float baseZ = isSecondary > 0.5 ? -0.35 : 0.0;
    float pz = baseZ + cos(u * 3.14159265 * 2.1 + curT * 0.32) * (isSecondary > 0.5 ? 0.35 : 0.52);
    pz += sin(u * 4.8 - curT * 0.4) * 0.15;

    return vec3(px, py, pz);
  }

  // Numerical tangent approximation along the 3D curve
  vec3 getTangent(float u, float t, float isSecondary) {
    float eps = 0.005;
    vec3 p0 = getCenterline(max(0.0, u - eps), t, isSecondary);
    vec3 p1 = getCenterline(min(1.0, u + eps), t, isSecondary);
    return normalize(p1 - p0);
  }

  // 3D Twisting angle of the ribbon plane along its tangent
  float getTwist(float u, float t, float isSecondary) {
    float pOff = isSecondary * 2.1;
    float curT = t * (isSecondary > 0.5 ? 0.8 : 1.0) + pOff;
    float twist = u * 3.8;
    twist += sin(u * 2.6 + curT * 0.38) * 1.2;
    twist += cos(u * 4.6 - curT * 0.28) * 0.55;
    twist += curT * 0.16; // Continuous meditative slow roll
    return twist;
  }

  // Ribbon width profile (smooth tapering at ends + sensual fluid breathing)
  float getHalfWidth(float u, float t, float isSecondary) {
    float taper = smoothstep(0.0, 0.14, u) * smoothstep(1.0, 0.86, u);
    float curT = t + isSecondary * 1.2;
    float breathe = 1.0 + 0.26 * sin(u * 3.4 - curT * 0.48) + 0.12 * cos(u * 6.5 + curT * 0.3);
    float baseW = isSecondary > 0.5 ? 0.18 : 0.28;
    return baseW * taper * breathe;
  }

  void main() {
    v_uv = vec2(a_u, a_v);

    vec3 c = getCenterline(a_u, u_time, u_ribbonId);
    vec3 T = getTangent(a_u, u_time, u_ribbonId);

    // Orthonormal frame
    vec3 refUp = vec3(0.0, 0.0, 1.0);
    if (abs(dot(T, refUp)) > 0.9) {
      refUp = vec3(0.0, 1.0, 0.0);
    }
    vec3 B0 = normalize(cross(T, refUp));
    vec3 N0 = normalize(cross(B0, T));

    float twist = getTwist(a_u, u_time, u_ribbonId);
    vec3 Vwidth = cos(twist) * B0 + sin(twist) * N0;
    vec3 Nsurf = -sin(twist) * B0 + cos(twist) * N0;

    float halfW = getHalfWidth(a_u, u_time, u_ribbonId);
    vec3 pos3D = c + a_v * halfW * Vwidth;

    v_normal = Nsurf;
    v_pos = pos3D;

    // Perspective projection
    float camDist = 2.4;
    float zDiv = 1.0 + pos3D.z * 0.36;
    float aspect = u_resolution.x / u_resolution.y;

    vec2 proj;
    if (aspect < 1.0) {
      // Mobile portrait framing
      proj = vec2(pos3D.x * (0.86 / aspect), pos3D.y * 0.94) / zDiv;
    } else {
      // Desktop / Tablet landscape framing
      proj = vec2(pos3D.x * 0.76, (pos3D.y * aspect) * 0.76) / zDiv;
    }

    gl_Position = vec4(proj, pos3D.z * 0.05, 1.0);

    // Calculate approximate screen-space pixel width for crisp edge highlights
    v_pixelWidth = (2.0 * halfW * (u_resolution.y * 0.5) / zDiv);
    v_depthFade = smoothstep(-0.65, 0.25, pos3D.z);
  }
`;

// --- Fragment Shader Source ---
const FS_SOURCE = `
  precision highp float;

  varying vec2 v_uv;
  varying vec3 v_normal;
  varying vec3 v_pos;
  varying float v_pixelWidth;
  varying float v_depthFade;

  uniform float u_time;
  uniform float u_ribbonId;

  void main() {
    float u = v_uv.x;
    float v = v_uv.y;

    // Distance from the primary illuminated edge (v = 1.0)
    float d1 = 1.0 - v; // 0.0 at illuminated edge, 2.0 at opposite edge
    float pDist = d1 * max(8.0, v_pixelWidth) * 0.5;

    // 1. Razor-sharp silver-white core highlight (~1.2px)
    float core = exp(-pDist * pDist / 1.7);

    // 2. Cool blue-violet sheen (~3.5px)
    float sheen = exp(-pDist / 3.4);

    // 3. Soft atmospheric navy/indigo volumetric bloom (~16px)
    float glow = exp(-pDist / 15.0);

    // Directional key light from upper-left/front
    vec3 keyLight = normalize(vec3(-0.45, 0.75, 0.65));
    vec3 viewDir = normalize(vec3(0.0, 0.0, 2.4) - v_pos);
    vec3 norm = normalize(v_normal);

    // Double-sided shading for twisting ribbon
    if (dot(norm, viewDir) < 0.0) {
      norm = -norm;
    }

    // Surface lighting
    float NdotL = dot(norm, keyLight);
    float diff = max(0.0, NdotL);
    vec3 halfVec = normalize(keyLight + viewDir);
    float spec = pow(max(0.0, dot(norm, halfVec)), 28.0);
    float fresnel = pow(1.0 - max(0.0, dot(norm, viewDir)), 2.6);

    // Main body: deep charcoal with subtle midnight-navy undertones
    vec3 deepCharcoal = vec3(0.024, 0.032, 0.050);
    vec3 litNavy = vec3(0.042, 0.068, 0.120);
    vec3 bodyColor = deepCharcoal + litNavy * diff * 0.85;
    bodyColor += vec3(0.10, 0.16, 0.26) * spec * 0.55;
    bodyColor += vec3(0.05, 0.09, 0.18) * fresnel * 0.70;

    // Edge illumination modulation
    float edgeFacing = 0.35 + 0.65 * max(0.0, NdotL * 0.5 + 0.5);
    float endFade = smoothstep(0.0, 0.14, u) * smoothstep(1.0, 0.86, u);
    float visibility = v_depthFade * endFade;

    // Razor silver-white core
    vec3 coreColor = vec3(0.96, 0.98, 1.00) * (core * 1.05);
    // Silver-blue cool violet tint
    vec3 sheenColor = vec3(0.58, 0.74, 0.96) * (sheen * 0.72);
    // Soft volumetric navy glow
    vec3 glowColor = vec3(0.12, 0.22, 0.44) * (glow * 0.38);

    vec3 edgeColor = (coreColor + sheenColor + glowColor) * edgeFacing * (0.45 + 0.55 * v_depthFade);

    // Secondary opposite edge: very subtle dark rim for 3D presence
    float d2 = 1.0 + v;
    float pDist2 = d2 * max(8.0, v_pixelWidth) * 0.5;
    float backCore = exp(-pDist2 * pDist2 / 2.2) * 0.18;
    vec3 backRim = vec3(0.25, 0.38, 0.58) * backCore * (0.3 + 0.7 * v_depthFade);

    // Shadow falloff: large portions vanish into total darkness
    float shadow = smoothstep(-0.35, 0.35, NdotL);
    float bodyAlpha = mix(0.12, 0.94, shadow) * visibility;

    // Secondary ribbon dampening
    if (u_ribbonId > 0.5) {
      bodyColor *= 0.45;
      edgeColor *= 0.40;
      backRim *= 0.35;
      bodyAlpha *= 0.50;
    }

    vec3 finalColor = (bodyColor * bodyAlpha) + (edgeColor * visibility) + (backRim * visibility);
    float finalAlpha = min(1.0, bodyAlpha + (core + sheen * 0.8) * visibility);

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export const GalleryLiquidRibbonBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(performance.now());
  const lastTimeRef = useRef<number>(performance.now());
  const elapsedOffsetRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // Accessibility check: prefers-reduced-motion
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = reducedMotionQuery.matches;

    const handleReducedMotion = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
    };
    reducedMotionQuery.addEventListener('change', handleReducedMotion);

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // Attempt WebGL context initialization
    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let primaryVaoBuffer: WebGLBuffer | null = null;
    let secondaryVaoBuffer: WebGLBuffer | null = null;
    let primaryVertexCount = 0;
    let secondaryVertexCount = 0;
    let uTimeLoc: WebGLUniformLocation | null = null;
    let uResolutionLoc: WebGLUniformLocation | null = null;
    let uRibbonIdLoc: WebGLUniformLocation | null = null;
    let aULoc = -1;
    let aVLoc = -1;

    let useFallback2D = false;
    let ctx2D: CanvasRenderingContext2D | null = null;

    try {
      gl = (canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false }) ||
            canvas.getContext('experimental-webgl', { alpha: true, antialias: true, premultipliedAlpha: false })) as WebGLRenderingContext;

      if (!gl) {
        useFallback2D = true;
      }
    } catch {
      useFallback2D = true;
    }

    // Helper: compile shader
    const compileShader = (type: number, src: string): WebGLShader | null => {
      if (!gl) return null;
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('Ribbon Shader compile error:', gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    };

    if (gl) {
      const vs = compileShader(gl.VERTEX_SHADER, VS_SOURCE);
      const fs = compileShader(gl.FRAGMENT_SHADER, FS_SOURCE);
      if (vs && fs) {
        program = gl.createProgram();
        if (program) {
          gl.attachShader(program, vs);
          gl.attachShader(program, fs);
          gl.linkProgram(program);
          if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.warn('Ribbon Program link error:', gl.getProgramInfoLog(program));
            useFallback2D = true;
            gl = null;
          } else {
            gl.useProgram(program);
            uTimeLoc = gl.getUniformLocation(program, 'u_time');
            uResolutionLoc = gl.getUniformLocation(program, 'u_resolution');
            uRibbonIdLoc = gl.getUniformLocation(program, 'u_ribbonId');
            aULoc = gl.getAttribLocation(program, 'a_u');
            aVLoc = gl.getAttribLocation(program, 'a_v');

            // Generate triangle strip mesh for ribbons
            const createRibbonMesh = (segments: number) => {
              const verts: number[] = [];
              for (let i = 0; i <= segments; i++) {
                const u = i / segments;
                // Two vertices per segment: left (-1.0) and right (+1.0)
                verts.push(u, -1.0);
                verts.push(u, 1.0);
              }
              const buf = gl!.createBuffer();
              gl!.bindBuffer(gl!.ARRAY_BUFFER, buf);
              gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array(verts), gl!.STATIC_DRAW);
              return { buffer: buf, count: (segments + 1) * 2 };
            };

            const primaryMesh = createRibbonMesh(240);
            primaryVaoBuffer = primaryMesh.buffer;
            primaryVertexCount = primaryMesh.count;

            const secondaryMesh = createRibbonMesh(160);
            secondaryVaoBuffer = secondaryMesh.buffer;
            secondaryVertexCount = secondaryMesh.count;

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          }
        }
      } else {
        useFallback2D = true;
        gl = null;
      }
    }

    if (useFallback2D || !gl) {
      ctx2D = canvas.getContext('2d', { alpha: true });
    }

    // Resize handler
    const resizeCanvas = () => {
      if (!container || !canvas) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      if (gl) {
        gl.viewport(0, 0, canvas.width, canvas.height);
      } else if (ctx2D) {
        ctx2D.setTransform(1, 0, 0, 1, 0, 0);
        ctx2D.scale(dpr, dpr);
      }
    };

    resizeCanvas();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(container);

    // Fallback Canvas 2D render routine
    const renderFallback2D = (time: number) => {
      if (!ctx2D) return;
      ctx2D.clearRect(0, 0, width, height);

      // Evaluate 2D projected points along the 3D parametric S-curve
      const steps = 140;
      const leftPts: { x: number; y: number; z: number }[] = [];
      const rightPts: { x: number; y: number; z: number }[] = [];

      const aspect = width / height;

      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const py = (0.5 - u) * 2.5;

        const s1 = Math.sin(u * Math.PI * 1.85 - 0.2 + time * 0.35);
        const s2 = Math.sin(u * Math.PI * 3.7 + time * 0.5);
        const px = s1 * 0.64 + s2 * 0.12 + Math.sin(u * 3.0 - time * 0.42) * 0.14;
        const pz = Math.cos(u * Math.PI * 2.1 + time * 0.32) * 0.52;

        const zDiv = 1.0 + pz * 0.36;
        const taper = Math.sin(u * Math.PI);
        const halfW = 0.24 * taper * (1.0 + 0.24 * Math.sin(u * 3.4 - time * 0.48));

        const twist = u * 3.8 + Math.sin(u * 2.6 + time * 0.38) * 1.2 + time * 0.16;
        const cosT = Math.cos(twist);
        const sinT = Math.sin(twist);

        const screenScaleX = aspect < 1.0 ? (0.86 / aspect) : 0.76;
        const screenScaleY = aspect < 1.0 ? 0.94 : (aspect * 0.76);

        const centerX = (px * screenScaleX / zDiv + 1) * 0.5 * width;
        const centerY = (1 - (py * screenScaleY / zDiv + 1) * 0.5) * height;

        const offsetDist = (halfW * screenScaleX / zDiv) * width * 0.5;
        const lx = centerX - offsetDist * cosT;
        const ly = centerY - offsetDist * sinT * 0.5;
        const rx = centerX + offsetDist * cosT;
        const ry = centerY + offsetDist * sinT * 0.5;

        leftPts.push({ x: lx, y: ly, z: pz });
        rightPts.push({ x: rx, y: ry, z: pz });
      }

      // Draw ribbon body
      ctx2D.beginPath();
      ctx2D.moveTo(leftPts[0].x, leftPts[0].y);
      for (let i = 1; i < leftPts.length; i++) {
        ctx2D.lineTo(leftPts[i].x, leftPts[i].y);
      }
      for (let i = rightPts.length - 1; i >= 0; i--) {
        ctx2D.lineTo(rightPts[i].x, rightPts[i].y);
      }
      ctx2D.closePath();

      const bodyGrad = ctx2D.createLinearGradient(0, 0, width, height);
      bodyGrad.addColorStop(0, 'rgba(8, 12, 22, 0.85)');
      bodyGrad.addColorStop(0.5, 'rgba(12, 18, 30, 0.92)');
      bodyGrad.addColorStop(1, 'rgba(6, 10, 18, 0.80)');
      ctx2D.fillStyle = bodyGrad;
      ctx2D.fill();

      // Stroke illuminated edge with multi-pass glows
      const traceLitEdge = (lineWidth: number, color: string) => {
        if (!ctx2D) return;
        ctx2D.beginPath();
        ctx2D.moveTo(leftPts[0].x, leftPts[0].y);
        for (let i = 1; i < leftPts.length; i++) {
          ctx2D.lineTo(leftPts[i].x, leftPts[i].y);
        }
        ctx2D.lineWidth = lineWidth;
        ctx2D.strokeStyle = color;
        ctx2D.stroke();
      };

      // 1. Soft deep navy ambient halo
      traceLitEdge(18, 'rgba(25, 45, 80, 0.16)');
      // 2. Cool blue-violet sheen
      traceLitEdge(6, 'rgba(95, 140, 210, 0.32)');
      // 3. Medium silver-blue highlight
      traceLitEdge(2.4, 'rgba(180, 210, 245, 0.65)');
      // 4. Razor-sharp silver-white core
      traceLitEdge(1.2, 'rgba(245, 250, 255, 0.95)');
    };

    // Animation Loop
    const render = (now: number) => {
      const dt = (now - lastTimeRef.current) * 0.001;
      lastTimeRef.current = now;

      // Slow, meditative fluid rate: ~25 seconds per full cycle
      const speed = prefersReducedMotion ? 0.04 : 0.32;
      elapsedOffsetRef.current += dt * speed;
      const t = elapsedOffsetRef.current;

      if (gl && program && primaryVaoBuffer && secondaryVaoBuffer) {
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        gl.uniform1f(uTimeLoc, t);
        gl.uniform2f(uResolutionLoc, canvas.width, canvas.height);

        // Render secondary undercurrent ribbon first (deeper in background)
        gl.uniform1f(uRibbonIdLoc, 1.0);
        gl.bindBuffer(gl.ARRAY_BUFFER, secondaryVaoBuffer);
        gl.enableVertexAttribArray(aULoc);
        gl.vertexAttribPointer(aULoc, 1, gl.FLOAT, false, 8, 0);
        gl.enableVertexAttribArray(aVLoc);
        gl.vertexAttribPointer(aVLoc, 1, gl.FLOAT, false, 8, 4);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, secondaryVertexCount);

        // Render primary dominant ribbon in front
        gl.uniform1f(uRibbonIdLoc, 0.0);
        gl.bindBuffer(gl.ARRAY_BUFFER, primaryVaoBuffer);
        gl.enableVertexAttribArray(aULoc);
        gl.vertexAttribPointer(aULoc, 1, gl.FLOAT, false, 8, 0);
        gl.enableVertexAttribArray(aVLoc);
        gl.vertexAttribPointer(aVLoc, 1, gl.FLOAT, false, 8, 4);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, primaryVertexCount);
      } else if (ctx2D) {
        renderFallback2D(t);
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    // Auto-pause when page or tab is hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      } else {
        lastTimeRef.current = performance.now();
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(render);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      reducedMotionQuery.removeEventListener('change', handleReducedMotion);

      if (gl) {
        if (primaryVaoBuffer) gl.deleteBuffer(primaryVaoBuffer);
        if (secondaryVaoBuffer) gl.deleteBuffer(secondaryVaoBuffer);
        if (program) gl.deleteProgram(program);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#0B0B0E]"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full pointer-events-none block"
      />
    </div>
  );
};

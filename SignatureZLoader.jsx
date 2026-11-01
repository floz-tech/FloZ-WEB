import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Code2, Check, Sliders, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

/**
 * OFFICIAL FLOZ LOGO GEOMETRY (1000 x 1000 SVG Coordinate System)
 * Exact faithful polygon reconstruction from the official FLOZ brand mark.
 * Never redrawn, distorted, or aspect-warped.
 */
const FLOZ_GEOMETRY = {
  // Segment 1: Main Z-Body
  Z_MAIN: "M 368 294 L 738 294 L 738 334 L 534 590 L 640 590 L 640 660 L 416 660 L 416 618 L 620 362 L 278 362 Z",

  // Segment 2: Left lower-F stem
  F_STEM: "M 348 430 L 516 430 L 454 508 L 350 508 L 350 660 L 266 660 L 266 502 Z",

  // Segment 3: Bottom-right triangular wedge
  Z_WEDGE: "M 670 592 L 748 660 L 670 660 Z",

  // Exact continuous perimeter path for the liquid-smooth Stage 3 luminance wave
  Z_PERIMETER_WAVE: "M 278 362 L 368 294 L 738 294 L 738 334 L 534 590 L 640 590 L 640 660 L 416 660 L 416 618 L 620 362 Z",

  // Centerline spine path for internal subsurface light conduction
  Z_SPINE_CONDUCTOR: "M 323 328 L 679 328 L 475 625 L 640 625",

  // Seam contact lines between the 3 segments (illuminated at moment of precision lock)
  INNER_SEAM_1: "M 278 396 L 548 396 L 384 602 L 384 660",
  INNER_SEAM_2: "M 655 590 L 655 660"
};

/**
 * 5 NATURAL ARCHITECTURAL PLANES OF THE Z_MAIN + F_STEM + Z_WEDGE
 */
const ARCHITECTURAL_PLANES = [
  {
    id: 'top-cantilever',
    target: 'Z_MAIN',
    clip: "M 260 280 L 620 280 L 620 362 L 260 362 Z",
    dx: -14,
    dy: -8,
    scale: 1.012
  },
  {
    id: 'upper-miter-joint',
    target: 'Z_MAIN',
    clip: "M 620 280 L 755 280 L 755 362 L 620 362 Z",
    dx: 12,
    dy: -10,
    scale: 1.018
  },
  {
    id: 'diagonal-spine',
    target: 'Z_MAIN',
    clip: "M 410 362 L 750 362 L 534 590 L 410 590 Z",
    dx: 4,
    dy: -2,
    scale: 1.024
  },
  {
    id: 'lower-miter-base',
    target: 'Z_MAIN',
    clip: "M 400 590 L 650 590 L 650 675 L 400 675 Z",
    dx: -6,
    dy: 11,
    scale: 1.014
  },
  {
    id: 'f-stem-plane',
    target: 'F_STEM',
    clip: "M 250 420 L 530 420 L 530 675 L 250 675 Z",
    dx: -15,
    dy: 7,
    scale: 1.015
  },
  {
    id: 'wedge-plane',
    target: 'Z_WEDGE',
    clip: "M 660 580 L 765 580 L 765 675 L 660 675 Z",
    dx: 16,
    dy: 11,
    scale: 1.022
  }
];

// Precision studio easing functions
const easeOutQuint = (x) => 1 - Math.pow(1 - x, 5);
const easeOutExpo = (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x));
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeInOutQuart = (x) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2);
const easeInExpo = (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10));
const clamp = (val, min = 0, max = 1) => Math.max(min, Math.min(max, val));

export default function App() {
  const TOTAL_DURATION = 2.60;

  const [isLoading, setIsLoading] = useState(true);
  const [loaderUnmounted, setLoaderUnmounted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [lockedPhase, setLockedPhase] = useState(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [heroTilt, setHeroTilt] = useState({ x: 0, y: 0 });

  const [animTime, setAnimTime] = useState(0);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const isSiteLoadedRef = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const listener = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);

    if (document.readyState === 'complete') {
      isSiteLoadedRef.current = true;
    } else {
      const onLoad = () => { isSiteLoadedRef.current = true; };
      window.addEventListener('load', onLoad);
      return () => {
        window.removeEventListener('load', onLoad);
        mediaQuery.removeEventListener('change', listener);
      };
    }
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  const startSequence = useCallback((customSpeed = playbackSpeed, phaseLock = lockedPhase) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsScrubbing(false);
    setLoaderUnmounted(false);
    setIsLoading(true);
    startTimeRef.current = null;

    if (reducedMotion && phaseLock === null) {
      setAnimTime(TOTAL_DURATION);
      const timer = setTimeout(() => {
        setIsLoading(false);
        setLoaderUnmounted(true);
      }, 300);
      return () => clearTimeout(timer);
    }

    const step = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const rawElapsed = ((timestamp - startTimeRef.current) / 1000) * customSpeed;

      if (phaseLock !== null) {
        const phaseRanges = {
          1: [0.00, 0.60],
          2: [0.60, 1.30],
          3: [1.30, 2.00],
          4: [2.00, 2.54]
        };
        const [start, end] = phaseRanges[phaseLock];
        const duration = end - start;
        const loopedTime = start + (rawElapsed % duration);
        setAnimTime(loopedTime);
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      if (!isSiteLoadedRef.current && rawElapsed >= 1.98) {
        const holdLoop = 1.30 + ((rawElapsed - 1.30) % 0.68);
        setAnimTime(holdLoop);
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      if (rawElapsed < TOTAL_DURATION) {
        setAnimTime(rawElapsed);
        rafRef.current = requestAnimationFrame(step);
      } else {
        setAnimTime(TOTAL_DURATION);
        setIsLoading(false);
        setLoaderUnmounted(true);
      }
    };

    rafRef.current = requestAnimationFrame(step);
  }, [playbackSpeed, lockedPhase, reducedMotion]);

  useEffect(() => {
    if (!isScrubbing) {
      startSequence(playbackSpeed, lockedPhase);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [startSequence, playbackSpeed, lockedPhase, isScrubbing]);

  const handleManualScrub = (newTime) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsScrubbing(true);
    setLoaderUnmounted(false);
    setIsLoading(true);
    setAnimTime(newTime);
  };

  const p1 = clamp(animTime / 0.60);
  const p2 = clamp((animTime - 0.60) / 0.70);
  const p3 = clamp((animTime - 1.30) / 0.70);
  const p4 = clamp((animTime - 2.00) / 0.60);

  const slitIgnition = easeOutExpo(clamp(animTime / 0.32));
  const slitFadeOut = clamp(1 - (animTime - 0.52) / 0.30);
  const slitOpacity = slitIgnition * slitFadeOut;
  const slitWidth = 2 + easeOutQuint(p1) * 280;

  const rimRevealOpacity = easeInOutCubic(clamp((animTime - 0.06) / 0.50));
  const lightSourceX = 360 + easeInOutCubic(p1) * 290;
  const lightSourceY = 580 - easeInOutCubic(p1) * 210;

  const interlockProgress = easeOutQuint(p2);
  const displacement = 1 - interlockProgress;

  const zMainX = displacement * 84;
  const zMainY = displacement * -105;
  const fStemX = displacement * -76;
  const fStemY = displacement * 95;
  const wedgeX = displacement * 92;
  const wedgeY = 0;

  const surfaceGradientOpacity = easeInOutCubic(clamp((animTime - 0.72) / 0.48));
  const seamContactWindow = clamp((animTime - 1.08) / 0.32);
  const seamFlashOpacity = seamContactWindow > 0 && seamContactWindow < 1 ? Math.sin(seamContactWindow * Math.PI) * 0.85 : 0;

  const waveProgress = easeInOutQuart(p3);
  const perimeterLength = 1860;
  const waveDashOffset = perimeterLength - waveProgress * (perimeterLength * 1.55);
  const waveOpacity = p3 > 0.01 && p3 < 0.99 ? Math.sin(p3 * Math.PI) : 0;

  const wedgeJumpWindow = clamp((p3 - 0.50) / 0.45);
  const wedgePulseGlow = wedgeJumpWindow > 0 && wedgeJumpWindow < 1 ? Math.sin(wedgeJumpWindow * Math.PI) : 0;

  const tessellationBell = p3 > 0.08 && p3 < 0.88 ? Math.pow(Math.sin(((p3 - 0.08) / 0.80) * Math.PI), 1.6) : 0;

  const perspectiveScaleX = 1 - tessellationBell * 0.022;
  const perspectiveScaleY = 1 + tessellationBell * 0.014;
  const perspectiveSkewX = tessellationBell * -1.8;

  const portalZoomProgress = clamp((animTime - 2.06) / 0.54);
  const portalEase = easeInExpo(portalZoomProgress);
  const zPortalScale = 1 + portalEase * 58;

  const zInteriorFillOpacity = clamp(1 - easeOutExpo(clamp((portalZoomProgress - 0.04) / 0.46)));
  const loaderOverlayOpacity = isScrubbing
    ? clamp(1 - easeOutExpo(clamp((portalZoomProgress - 0.85) / 0.15)))
    : clamp(1 - easeOutExpo(clamp((portalZoomProgress - 0.72) / 0.28)));

  const copyStandaloneSnippet = () => {
    const snippet = `<!-- Official FLOZ Signature Z Symbol (1000x1000 Coordinate Space) -->
<svg viewBox="0 0 1000 1000" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="floz-official-grad" x1="266" y1="660" x2="738" y2="294" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0033FF" />
      <stop offset="52%" stop-color="#0095FF" />
      <stop offset="100%" stop-color="#33ECFF" />
    </linearGradient>
  </defs>
  <path d="${FLOZ_GEOMETRY.Z_MAIN}" fill="url(#floz-official-grad)" />
  <path d="${FLOZ_GEOMETRY.F_STEM}" fill="url(#floz-official-grad)" />
  <path d="${FLOZ_GEOMETRY.Z_WEDGE}" fill="url(#floz-official-grad)" />
</svg>`;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#04060A] text-slate-100 overflow-x-hidden selection:bg-cyan-500/20 selection:text-cyan-200 font-sans antialiased">
      
      {/* Underlying Website */}
      <div className="relative min-h-screen w-full flex flex-col justify-between bg-[#050811]">
        <div
          className="pointer-events-none fixed inset-0"
          style={{
            background: `
              radial-gradient(80% 55% at 50% 0%, rgba(0, 110, 255, 0.13) 0%, rgba(0, 40, 120, 0.04) 50%, transparent 100%),
              linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)
            `
          }}
        />

        <header className="relative z-10 max-w-6xl w-full mx-auto px-6 sm:px-10 py-6 flex items-center justify-between border-b border-white/[0.06]">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-[#04060A] border border-white/10 flex items-center justify-center shadow-inner">
              <svg viewBox="220 250 570 460" className="w-5 h-5">
                <defs>
                  <linearGradient id="nav-floz-grad" x1="266" y1="660" x2="738" y2="294" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#0033FF" />
                    <stop offset="52%" stopColor="#0095FF" />
                    <stop offset="100%" stopColor="#33ECFF" />
                  </linearGradient>
                </defs>
                <path d={FLOZ_GEOMETRY.Z_MAIN} fill="url(#nav-floz-grad)" />
                <path d={FLOZ_GEOMETRY.F_STEM} fill="url(#nav-floz-grad)" />
                <path d={FLOZ_GEOMETRY.Z_WEDGE} fill="url(#nav-floz-grad)" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-[0.26em] text-white">FLOZ</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-medium tracking-wide text-slate-400">
            <a href="#platform" onClick={(e) => e.preventDefault()} className="hover:text-white transition-colors">Architecture</a>
            <a href="#engine" onClick={(e) => e.preventDefault()} className="hover:text-white transition-colors">Precision Engine</a>
            <a href="#security" onClick={(e) => e.preventDefault()} className="hover:text-white transition-colors">Benchmarks</a>
            <a href="#docs" onClick={(e) => e.preventDefault()} className="hover:text-white transition-colors">Documentation</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setLockedPhase(null);
                startSequence(1, null);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.11] border border-white/10 text-white transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              Replay Loader
            </button>
          </div>
        </header>

        <main className="relative z-10 max-w-6xl w-full mx-auto px-6 sm:px-10 py-16 md:py-24 flex flex-col lg:flex-row items-center justify-between gap-14">
          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-slate-300 text-[11px] font-medium tracking-widest uppercase mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#33ECFF]" />
              Bespoke Brand Motion System
            </div>

            <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight text-white max-w-xl leading-[1.06]">
              Precision engineered.{' '}
              <span className="bg-gradient-to-r from-[#0044FF] via-[#0095FF] to-[#33ECFF] bg-clip-text text-transparent">
                Pure geometry.
              </span>
            </h1>

            <p className="mt-5 text-sm sm:text-base text-slate-400 max-w-lg leading-relaxed font-normal">
              Crafted with physical restraint: anamorphic rim lighting on matte-black bevels, 51.5° chamfer interlock physics, architectural 5-plane tessellation, and a seamless Z-aperture reveal.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3.5">
              <button
                onClick={() => {
                  setLockedPhase(null);
                  setPlaybackSpeed(1);
                  startSequence(1, null);
                }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-slate-950 font-medium text-xs tracking-wide hover:bg-slate-100 transition-all shadow-lg shadow-white/5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                Replay Full Sequence (1x)
              </button>

              <button
                onClick={() => {
                  setLockedPhase(null);
                  setPlaybackSpeed(0.25);
                  startSequence(0.25, null);
                }}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-200 text-xs font-medium transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Inspect in 0.25x Slow-Mo
              </button>

              <button
                onClick={() => setShowCodeModal(true)}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] text-slate-300 text-xs font-medium transition-all cursor-pointer"
              >
                <Code2 className="w-3.5 h-3.5 text-slate-400" />
                Export SVG Asset
              </button>
            </div>

            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-xl">
              {[
                { stage: '01', name: 'Rim Reveal', time: '0.0–0.6s', desc: 'Anamorphic edge-catch' },
                { stage: '02', name: '51.5° Interlock', time: '0.6–1.3s', desc: 'Machined chamfer lock' },
                { stage: '03', name: 'Tessellation', time: '1.3–2.0s', desc: '5-plane energy pulse' },
                { stage: '04', name: 'Z-Aperture', time: '2.0–2.6s', desc: 'Optical mask transition' }
              ].map((item, idx) => (
                <button
                  key={item.stage}
                  onClick={() => {
                    const phaseNum = idx + 1;
                    setLockedPhase(phaseNum);
                    startSequence(playbackSpeed, phaseNum);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    lockedPhase === idx + 1
                      ? 'bg-blue-500/10 border-cyan-400/40'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>STAGE {item.stage}</span>
                    <span>{item.time}</span>
                  </div>
                  <div className="text-xs font-medium text-white mt-1">{item.name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
              const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
              setHeroTilt({ x: nx * 12, y: -ny * 12 });
            }}
            onMouseLeave={() => setHeroTilt({ x: 0, y: 0 })}
            className="relative w-72 h-72 sm:w-88 sm:h-88 rounded-[32px] bg-[#030509] border border-white/[0.08] flex flex-col items-center justify-center p-8 shadow-2xl shadow-black/80 cursor-default group"
          >
            <div className="absolute top-5 left-6 right-6 flex items-center justify-between text-[10px] font-mono tracking-wider text-slate-500 uppercase">
              <span>FLOZ SYMBOL</span>
              <span>1:1 GEOMETRY</span>
            </div>
            <svg
              viewBox="200 220 600 520"
              className="w-full h-full transition-transform duration-200 ease-out"
              style={{
                transform: `perspective(900px) rotateY(${heroTilt.x}deg) rotateX(${heroTilt.y}deg)`
              }}
            >
              <defs>
                <linearGradient id="hero-card-grad" x1="266" y1="660" x2="738" y2="294" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#0033FF" />
                  <stop offset="52%" stopColor="#0095FF" />
                  <stop offset="100%" stopColor="#33ECFF" />
                </linearGradient>
              </defs>
              <path d={FLOZ_GEOMETRY.Z_MAIN} fill="url(#hero-card-grad)" />
              <path d={FLOZ_GEOMETRY.F_STEM} fill="url(#hero-card-grad)" />
              <path d={FLOZ_GEOMETRY.Z_WEDGE} fill="url(#hero-card-grad)" />
            </svg>
            <div className="absolute bottom-4 text-[11px] text-slate-500 group-hover:text-slate-300 transition-colors">
              Official 3-segment silhouette
            </div>
          </div>
        </main>

        <footer className="relative z-10 max-w-6xl w-full mx-auto px-6 sm:px-10 py-6 border-t border-white/[0.05] flex items-center justify-between text-xs text-slate-500">
          <span>FLOZ — Signature Z Loading Experience</span>
          <span>60 FPS Hardware-Accelerated SVG</span>
        </footer>
      </div>

      {/* Loading Screen Overlay */}
      {!loaderUnmounted && (
        <div
          aria-busy={isLoading}
          aria-label="Loading"
          className="fixed inset-0 z-40 pointer-events-auto select-none overflow-hidden flex items-center justify-center"
          style={{
            opacity: loaderOverlayOpacity,
            willChange: 'opacity'
          }}
        >
          <svg
            viewBox="0 0 1000 1000"
            preserveAspectRatio="xMidYMid slice"
            className="w-full h-full block"
          >
            <defs>
              <linearGradient
                id="floz-brand-gradient"
                x1="266"
                y1="660"
                x2="738"
                y2="294"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#0033FF" />
                <stop offset="52%" stopColor="#0095FF" />
                <stop offset="100%" stopColor="#33ECFF" />
              </linearGradient>

              <linearGradient
                id="floz-matte-obsidian"
                x1="266"
                y1="294"
                x2="748"
                y2="660"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#0B111E" />
                <stop offset="50%" stopColor="#060A12" />
                <stop offset="100%" stopColor="#09101D" />
              </linearGradient>

              <radialGradient
                id="floz-specular-rim"
                cx={lightSourceX}
                cy={lightSourceY}
                r="320"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#70F3FF" stopOpacity="0.95" />
                <stop offset="35%" stopColor="#0088FF" stopOpacity="0.65" />
                <stop offset="75%" stopColor="#0033FF" stopOpacity="0.20" />
                <stop offset="100%" stopColor="#001133" stopOpacity="0" />
              </radialGradient>

              <linearGradient
                id="floz-surface-sheen"
                x1={150 + waveProgress * 550}
                y1={200 + waveProgress * 350}
                x2={320 + waveProgress * 550}
                y2={370 + waveProgress * 350}
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                <stop offset="50%" stopColor="#99F6FF" stopOpacity={0.38 * waveOpacity} />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>

              <linearGradient
                id="floz-luminance-wave"
                x1="266"
                y1="660"
                x2="738"
                y2="294"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#0033FF" stopOpacity="0" />
                <stop offset="40%" stopColor="#0095FF" stopOpacity="0.85" />
                <stop offset="85%" stopColor="#33ECFF" stopOpacity="1" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
              </linearGradient>

              {ARCHITECTURAL_PLANES.map((plane) => (
                <clipPath key={plane.id} id={`arch-clip-${plane.id}`}>
                  <path d={plane.clip} />
                </clipPath>
              ))}

              <filter id="floz-studio-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" result="softBlur" />
                <feComponentTransfer in="softBlur" result="dimmedBlur">
                  <feFuncA type="linear" slope="0.38" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode in="dimmedBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="floz-light-bloom" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2.5" result="tight" />
                <feGaussianBlur stdDeviation="9" result="ambient" />
                <feMerge>
                  <feMergeNode in="ambient" />
                  <feMergeNode in="tight" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <radialGradient id="floz-ambient-halo" cx="508" cy="477" r="290" gradientUnits="userSpaceOnUse">
                <stop
                  offset="0%"
                  stopColor="#0077FF"
                  stopOpacity={(0.12 * surfaceGradientOpacity + 0.10 * waveOpacity) * (1 - p4)}
                />
                <stop offset="60%" stopColor="#002266" stopOpacity={0.04 * (1 - p4)} />
                <stop offset="100%" stopColor="#030508" stopOpacity="0" />
              </radialGradient>

              <mask id="floz-portal-mask" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="5000" height="5000">
                <rect x="-2000" y="-2000" width="5000" height="5000" fill="#FFFFFF" />
                {portalZoomProgress > 0.005 && (
                  <g transform={`translate(518, 477) scale(${zPortalScale}) translate(-518, -477)`}>
                    <path d={FLOZ_GEOMETRY.Z_MAIN} fill="#000000" />
                    <path d={FLOZ_GEOMETRY.F_STEM} fill="#000000" />
                    <path d={FLOZ_GEOMETRY.Z_WEDGE} fill="#000000" />
                  </g>
                )}
              </mask>
            </defs>

            <g mask="url(#floz-portal-mask)">
              <rect x="-2000" y="-2000" width="5000" height="5000" fill="#030508" />
              <circle cx="508" cy="477" r="320" fill="url(#floz-ambient-halo)" />
            </g>

            <g
              transform={`
                translate(518, 477)
                scale(${zPortalScale})
                skewX(${perspectiveSkewX})
                scale(${perspectiveScaleX}, ${perspectiveScaleY})
                translate(-518, -477)
              `}
              style={{ opacity: zInteriorFillOpacity }}
            >
              {tessellationBell <= 0.005 && (
                <g filter="url(#floz-studio-glow)">
                  <g transform={`translate(${fStemX}, ${fStemY})`}>
                    <path d={FLOZ_GEOMETRY.F_STEM} fill="url(#floz-matte-obsidian)" opacity={rimRevealOpacity} />
                    <path d={FLOZ_GEOMETRY.F_STEM} fill="url(#floz-brand-gradient)" opacity={surfaceGradientOpacity} />
                    {waveOpacity > 0.01 && <path d={FLOZ_GEOMETRY.F_STEM} fill="url(#floz-surface-sheen)" />}
                    <path
                      d={FLOZ_GEOMETRY.F_STEM}
                      fill="none"
                      stroke="url(#floz-specular-rim)"
                      strokeWidth={1.35 - surfaceGradientOpacity * 0.55}
                      strokeLinejoin="miter"
                      opacity={rimRevealOpacity}
                    />
                  </g>

                  <g transform={`translate(${zMainX}, ${zMainY})`}>
                    <path d={FLOZ_GEOMETRY.Z_MAIN} fill="url(#floz-matte-obsidian)" opacity={rimRevealOpacity} />
                    <path d={FLOZ_GEOMETRY.Z_MAIN} fill="url(#floz-brand-gradient)" opacity={surfaceGradientOpacity} />
                    {waveOpacity > 0.01 && <path d={FLOZ_GEOMETRY.Z_MAIN} fill="url(#floz-surface-sheen)" />}
                    <path
                      d={FLOZ_GEOMETRY.Z_MAIN}
                      fill="none"
                      stroke="url(#floz-specular-rim)"
                      strokeWidth={1.45 - surfaceGradientOpacity * 0.55}
                      strokeLinejoin="miter"
                      opacity={rimRevealOpacity}
                    />
                  </g>

                  <g transform={`translate(${wedgeX}, ${wedgeY})`}>
                    <path d={FLOZ_GEOMETRY.Z_WEDGE} fill="url(#floz-matte-obsidian)" opacity={rimRevealOpacity} />
                    <path d={FLOZ_GEOMETRY.Z_WEDGE} fill="url(#floz-brand-gradient)" opacity={surfaceGradientOpacity} />
                    {wedgePulseGlow > 0.01 && (
                      <path
                        d={FLOZ_GEOMETRY.Z_WEDGE}
                        fill="#70F3FF"
                        opacity={wedgePulseGlow * 0.55}
                        filter="url(#floz-light-bloom)"
                      />
                    )}
                    <path
                      d={FLOZ_GEOMETRY.Z_WEDGE}
                      fill="none"
                      stroke="url(#floz-specular-rim)"
                      strokeWidth={1.35 - surfaceGradientOpacity * 0.45}
                      strokeLinejoin="miter"
                      opacity={rimRevealOpacity}
                    />
                  </g>
                </g>
              )}

              {tessellationBell > 0.005 && (
                <g filter="url(#floz-studio-glow)">
                  <g opacity={tessellationBell * 0.75} filter="url(#floz-light-bloom)">
                    <path
                      d={FLOZ_GEOMETRY.Z_SPINE_CONDUCTOR}
                      fill="none"
                      stroke="#33ECFF"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </g>

                  {ARCHITECTURAL_PLANES.map((plane) => {
                    const tx = plane.dx * tessellationBell;
                    const ty = plane.dy * tessellationBell;
                    const planeScale = 1 + (plane.scale - 1) * tessellationBell;
                    const targetPath = FLOZ_GEOMETRY[plane.target];

                    return (
                      <g
                        key={plane.id}
                        clipPath={`url(#arch-clip-${plane.id})`}
                        transform={`translate(508, 477) scale(${planeScale}) translate(-508, -477) translate(${tx}, ${ty})`}
                      >
                        <path d={targetPath} fill="url(#floz-brand-gradient)" />
                        <path d={targetPath} fill="url(#floz-surface-sheen)" />
                        {plane.target === 'Z_WEDGE' && wedgePulseGlow > 0.01 && (
                          <path d={targetPath} fill="#70F3FF" opacity={wedgePulseGlow * 0.55} />
                        )}
                        <path
                          d={targetPath}
                          fill="none"
                          stroke="#80F5FF"
                          strokeWidth={0.9 * tessellationBell}
                          opacity={0.75 * tessellationBell}
                        />
                      </g>
                    );
                  })}
                </g>
              )}

              {seamFlashOpacity > 0.01 && (
                <g opacity={seamFlashOpacity} filter="url(#floz-light-bloom)">
                  <path
                    d={FLOZ_GEOMETRY.INNER_SEAM_1}
                    fill="none"
                    stroke="#70F3FF"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="miter"
                  />
                  <path
                    d={FLOZ_GEOMETRY.INNER_SEAM_2}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </g>
              )}

              {waveOpacity > 0.01 && (
                <g opacity={waveOpacity} filter="url(#floz-light-bloom)">
                  <path
                    d={FLOZ_GEOMETRY.Z_PERIMETER_WAVE}
                    fill="none"
                    stroke="url(#floz-luminance-wave)"
                    strokeWidth="3.8"
                    strokeLinecap="round"
                    strokeLinejoin="miter"
                    strokeDasharray="380 2000"
                    strokeDashoffset={waveDashOffset}
                  />
                  <path
                    d={FLOZ_GEOMETRY.Z_PERIMETER_WAVE}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="miter"
                    strokeDasharray="120 2000"
                    strokeDashoffset={waveDashOffset - 35}
                  />
                </g>
              )}
            </g>

            {portalZoomProgress > 0.01 && portalZoomProgress < 0.92 && (
              <g
                transform={`translate(518, 477) scale(${zPortalScale}) translate(-518, -477)`}
                opacity={Math.sin((portalZoomProgress / 0.92) * Math.PI) * 0.65}
                filter="url(#floz-light-bloom)"
              >
                <path d={FLOZ_GEOMETRY.Z_MAIN} fill="none" stroke="#33ECFF" strokeWidth={Math.max(0.18, 1.8 / Math.sqrt(zPortalScale))} />
                <path d={FLOZ_GEOMETRY.F_STEM} fill="none" stroke="#0095FF" strokeWidth={Math.max(0.15, 1.5 / Math.sqrt(zPortalScale))} />
                <path d={FLOZ_GEOMETRY.Z_WEDGE} fill="none" stroke="#70F3FF" strokeWidth={Math.max(0.18, 1.8 / Math.sqrt(zPortalScale))} />
              </g>
            )}

            {slitOpacity > 0.01 && (
              <g
                transform="translate(518, 462) rotate(-51.5)"
                opacity={slitOpacity}
                filter="url(#floz-light-bloom)"
              >
                <ellipse cx="0" cy="0" rx={slitWidth} ry={1.2 + slitIgnition * 1.4} fill="#0088FF" opacity="0.65" />
                <ellipse cx="0" cy="0" rx={slitWidth * 0.48} ry="0.75" fill="#FFFFFF" />
              </g>
            )}
          </svg>
        </div>
      )}

      {/* Motion Inspector Drawer */}
      {(!isLoading || lockedPhase !== null || isScrubbing) && (
        <div className="fixed bottom-5 right-5 z-50 w-[92vw] max-w-md bg-[#070B14]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/90 overflow-hidden text-xs">
          <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.07]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#33ECFF]" />
              <span className="font-medium text-white tracking-wide">Studio Motion Inspector</span>
              <span className="font-mono text-[11px] text-slate-400 ml-1">
                {animTime.toFixed(2)}s / {TOTAL_DURATION.toFixed(2)}s
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setLockedPhase(null);
                  startSequence(playbackSpeed, null);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-slate-950 font-medium text-[11px] hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Replay
              </button>
              <button
                onClick={() => setInspectorOpen(!inspectorOpen)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                {inspectorOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {inspectorOpen && (
            <div className="p-4 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3 h-3 text-cyan-400" />
                    Timeline Scrub
                  </span>
                  <span className="font-mono text-cyan-300">
                    {animTime < 0.60
                      ? '01. Anamorphic Rim Entry'
                      : animTime < 1.30
                      ? '02. 51.5° Machined Interlock'
                      : animTime < 2.00
                      ? '03. 5-Plane Tessellation & Wave'
                      : '04. Z-Aperture Mask Reveal'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={TOTAL_DURATION}
                  step="0.005"
                  value={animTime}
                  onChange={(e) => handleManualScrub(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.06]">
                <div className="flex items-center gap-1">
                  {[
                    { id: null, label: 'All' },
                    { id: 1, label: 'S1' },
                    { id: 2, label: 'S2' },
                    { id: 3, label: 'S3' },
                    { id: 4, label: 'S4' }
                  ].map((st) => (
                    <button
                      key={String(st.id)}
                      onClick={() => {
                        setLockedPhase(st.id);
                        startSequence(playbackSpeed, st.id);
                      }}
                      className={`px-2 py-1 rounded-md font-mono text-[11px] transition-all cursor-pointer ${
                        lockedPhase === st.id && !isScrubbing
                          ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/40'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 rounded-lg p-0.5">
                  {[0.25, 0.5, 1].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => {
                        setPlaybackSpeed(spd);
                        startSequence(spd, lockedPhase);
                      }}
                      className={`px-2 py-0.5 rounded font-mono text-[11px] transition-all cursor-pointer ${
                        playbackSpeed === spd
                          ? 'bg-white/15 text-white font-medium'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SVG Export Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#070B14] border border-white/10 rounded-2xl max-w-2xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Code2 className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">
                  Official FLOZ Symbol Vector Paths (1000×1000 Coordinate System)
                </h2>
              </div>
              <button
                onClick={() => setShowCodeModal(false)}
                className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                Close
              </button>
            </div>

            <pre className="mt-4 p-4 rounded-xl bg-[#04060A] border border-white/10 text-[11px] font-mono text-cyan-300 overflow-x-auto leading-relaxed">
{`const Z_MAIN  = "${FLOZ_GEOMETRY.Z_MAIN}";
const F_STEM  = "${FLOZ_GEOMETRY.F_STEM}";
const Z_WEDGE = "${FLOZ_GEOMETRY.Z_WEDGE}";`}
            </pre>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={copyStandaloneSnippet}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-950 font-medium text-xs hover:bg-slate-200 transition-all cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Code2 className="w-3.5 h-3.5" />}
                {copied ? 'Copied Official SVG' : 'Copy SVG Snippet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

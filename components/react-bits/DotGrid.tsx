"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";

type Dot = {
  cx: number;
  cy: number;
};

export type DotGridProps = {
  dotSize?: number;
  gap?: number;
  baseColor?: string;
  activeColor?: string;
  proximity?: number;
  className?: string;
  style?: CSSProperties;
};

function hexToRgb(hex: string) {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return { r: 0, g: 0, b: 0 };
  return {
    r: Number.parseInt(match[1], 16),
    g: Number.parseInt(match[2], 16),
    b: Number.parseInt(match[3], 16),
  };
}

function throttle<T extends (...args: never[]) => void>(fn: T, limit: number) {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = performance.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn(...args);
    }
  };
}

/**
 * Adapted from React Bits — Dot Grid (TS + Tailwind).
 * Proximity highlight only (no GSAP Club InertiaPlugin).
 * @see https://reactbits.dev/backgrounds/dot-grid
 */
export function DotGrid({
  dotSize = 3,
  gap = 28,
  baseColor = "#1a2a3d",
  activeColor = "#178bff",
  proximity = 120,
  className = "",
  style,
}: DotGridProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const pointerRef = useRef({ x: -9999, y: -9999 });

  const baseRgb = useMemo(() => hexToRgb(baseColor), [baseColor]);
  const activeRgb = useMemo(() => hexToRgb(activeColor), [activeColor]);

  const circlePath = useMemo(() => {
    if (typeof window === "undefined" || !window.Path2D) return null;
    const path = new Path2D();
    path.arc(0, 0, dotSize / 2, 0, Math.PI * 2);
    return path;
  }, [dotSize]);

  const buildGrid = useCallback(() => {
    const wrap = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const { width, height } = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    const cell = dotSize + gap;
    const cols = Math.floor((width + gap) / cell);
    const rows = Math.floor((height + gap) / cell);
    const gridW = cell * cols - gap;
    const gridH = cell * rows - gap;
    const startX = (width - gridW) / 2 + dotSize / 2;
    const startY = (height - gridH) / 2 + dotSize / 2;

    const dots: Dot[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        dots.push({
          cx: startX + col * cell,
          cy: startY + row * cell,
        });
      }
    }
    dotsRef.current = dots;
  }, [dotSize, gap]);

  useEffect(() => {
    if (!circlePath) return;

    let rafId = 0;
    const proxSq = proximity * proximity;

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);

      const { x: px, y: py } = pointerRef.current;

      for (const dot of dotsRef.current) {
        const dx = dot.cx - px;
        const dy = dot.cy - py;
        const dsq = dx * dx + dy * dy;

        let fill = baseColor;
        if (dsq <= proxSq) {
          const dist = Math.sqrt(dsq);
          const t = 1 - dist / proximity;
          const r = Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * t);
          const g = Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * t);
          const b = Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * t);
          fill = `rgb(${r},${g},${b})`;
        }

        ctx.save();
        ctx.translate(dot.cx, dot.cy);
        ctx.fillStyle = fill;
        ctx.fill(circlePath);
        ctx.restore();
      }

      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [activeRgb, baseColor, baseRgb, circlePath, proximity]);

  useEffect(() => {
    buildGrid();

    const wrap = wrapperRef.current;
    if (!wrap) return;

    const observer = new ResizeObserver(buildGrid);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [buildGrid]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      pointerRef.current.x = event.clientX - rect.left;
      pointerRef.current.y = event.clientY - rect.top;
    };

    const onLeave = () => {
      pointerRef.current.x = -9999;
      pointerRef.current.y = -9999;
    };

    const throttledMove = throttle(onMove, 32);
    window.addEventListener("mousemove", throttledMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);

    return () => {
      window.removeEventListener("mousemove", throttledMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={`absolute inset-0 h-full w-full ${className}`}
      style={style}
      aria-hidden
    >
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
    </div>
  );
}

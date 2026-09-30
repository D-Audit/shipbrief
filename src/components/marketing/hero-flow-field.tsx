"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Hero backdrop: hairline curves sweep in from both edges and converge on the
 * call to action, with small square particles travelling along them — shipped
 * work flowing into ShipBrief. Decorative only; the headline never moves.
 * Canvas-drawn, paused when off-screen or the tab is hidden, and a single
 * still frame under reduced motion.
 */

type Curve = { p0: [number, number]; c1: [number, number]; c2: [number, number]; p1: [number, number] };
type Particle = { curve: number; t: number; speed: number; accent: boolean };

const LINES_PER_SIDE = 9;
const PARTICLES = 46;
const ACCENT = "#B3DC24"; // #C7F238, a touch deeper so the squares read on the light grey

function point(c: Curve, t: number): [number, number] {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
  return [a * c.p0[0] + b * c.c1[0] + d * c.c2[0] + e * c.p1[0], a * c.p0[1] + b * c.c1[1] + d * c.c2[1] + e * c.p1[1]];
}

export function HeroFlowField({ targetId, className }: { targetId: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let curves: Curve[] = [];
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let visible = true;
    let last = performance.now();

    const layout = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Converge on the call to action (falls back to the middle of the hero).
      const target = document.getElementById(targetId)?.getBoundingClientRect();
      const cx = target ? target.left + target.width / 2 - rect.left : width / 2;
      const cy = target ? target.top + target.height / 2 - rect.top : height * 0.6;
      const gap = Math.min(target ? target.width / 2 + 40 : 220, width * 0.3);

      curves = [];
      for (const side of [-1, 1]) {
        for (let i = 0; i < LINES_PER_SIDE; i++) {
          const f = i / (LINES_PER_SIDE - 1); // 0 top → 1 bottom
          const edgeX = side < 0 ? -20 : width + 20;
          const startY = height * (-0.1 + f * 1.15);
          const endX = cx + side * gap;
          const endY = cy + (f - 0.5) * 18;
          curves.push({
            p0: [edgeX, startY],
            c1: [edgeX - side * width * 0.28, startY],
            c2: [endX + side * width * 0.16, endY + (f - 0.5) * 40],
            p1: [endX, endY],
          });
        }
      }
      particles = Array.from({ length: PARTICLES }, (_, i) => ({
        curve: i % curves.length,
        t: Math.random(),
        speed: 0.05 + Math.random() * 0.06,
        accent: i % 4 === 0,
      }));
    };

    const draw = (dt: number) => {
      // Read per frame so toggling light/dark recolours the field immediately.
      const dark = document.documentElement.classList.contains("dark");
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = dark ? "rgba(244, 245, 247, 0.16)" : "rgba(23, 23, 23, 0.07)";
      for (const c of curves) {
        ctx.beginPath();
        ctx.moveTo(c.p0[0], c.p0[1]);
        ctx.bezierCurveTo(c.c1[0], c.c1[1], c.c2[0], c.c2[1], c.p1[0], c.p1[1]);
        ctx.stroke();
      }
      for (const p of particles) {
        p.t += p.speed * dt;
        if (p.t > 1) {
          p.t = 0;
          p.curve = Math.floor(Math.random() * curves.length);
        }
        const [x, y] = point(curves[p.curve], p.t);
        // Fade in off the edge, fade out as it arrives at the CTA.
        const alpha = Math.min(1, p.t * 6, (1 - p.t) * 5);
        const size = p.accent ? 3.5 : 2.5;
        ctx.globalAlpha = alpha * (p.accent ? 1 : dark ? 0.6 : 0.35);
        ctx.fillStyle = p.accent ? (dark ? "#C7F238" : ACCENT) : dark ? "#F4F5F7" : "#171717";
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(dt);
      if (visible && !document.hidden) frame = requestAnimationFrame(tick);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      last = performance.now();
      if (reduce) draw(0);
      else frame = requestAnimationFrame(tick);
    };

    layout();
    start();

    const resize = new ResizeObserver(() => {
      layout();
      if (reduce) draw(0);
    });
    resize.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    });
    io.observe(canvas);
    const onVisibility = () => !document.hidden && visible && start();
    document.addEventListener("visibilitychange", onVisibility);
    // The still frame (reduced motion) must be redrawn when the theme changes.
    const themeWatch = new MutationObserver(() => reduce && draw(0));
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      themeWatch.disconnect();
    };
  }, [targetId]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -z-10 w-full [mask-image:linear-gradient(to_bottom,transparent,#000_10%,#000_78%,transparent)]",
        className
      )}
    />
  );
}

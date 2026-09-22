"use client";

import * as React from "react";
import Lenis from "lenis";

import { scrollState } from "@/lib/motion/scroll-state";
import { useCinematicMotion } from "@/lib/motion/use-cinematic-motion";

/**
 * Real Lenis scroll physics for this surface — inertia/lerp-smoothed
 * wheel/touch/trackpad input, the exact mechanism lenis.dev itself
 * demonstrates. Writes live velocity/progress into `scrollState` for the
 * WebGL string field to read every frame without a React re-render.
 *
 * Always on for this page (see `useCinematicMotion`) — the landing page's
 * smooth-scroll feel is part of the product, not incidental motion.
 */
export function LenisProvider({ children }: { children: React.ReactNode }) {
  const reduced = useCinematicMotion();

  React.useEffect(() => {
    if (reduced) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
      touchMultiplier: 1.1,
    });

    lenis.on("scroll", ({ velocity, progress }: { velocity: number; progress: number }) => {
      scrollState.velocity = velocity;
      scrollState.progress = progress;
    });

    let frame: number;
    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      scrollState.velocity = 0;
    };
  }, [reduced]);

  return <>{children}</>;
}

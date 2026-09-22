"use client";

import * as React from "react";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion, type MotionValue } from "framer-motion";

import { EASE } from "@/lib/motion";
import { scrollState } from "@/lib/motion/scroll-state";

/**
 * A cinematic staged reveal for a short sequence of lines (a kicker, a
 * title, a subtitle) — each line blurs in from below and sharpens, offset
 * in time from the next, rather than the whole block appearing at once.
 * This is the hero's entrance; everywhere else still uses the plainer
 * `Reveal` fade — one signature moment, not a house style applied
 * everywhere (craft-floor: "one authored moment, not scattered effects").
 */
export function TextReveal({
  lines,
  className,
  stagger = 0.16,
  startDelay = 0.1,
}: {
  lines: React.ReactNode[];
  className?: string;
  stagger?: number;
  startDelay?: number;
}) {
  const reduced = useReducedMotion();

  return (
    <div className={className}>
      {lines.map((line, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 28, filter: "blur(14px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            duration: reduced ? 0 : 1.1,
            ease: EASE,
            delay: reduced ? 0 : startDelay + i * stagger,
          }}
        >
          {line}
        </motion.div>
      ))}
    </div>
  );
}

/**
 * A subtle skew driven by scroll velocity — barely noticeable at rest, a
 * slight stretch while flicking past it fast. Returns a Framer
 * `MotionValue`, not React state: `useAnimationFrame` writes to it every
 * frame without triggering a re-render, the same "read scrollState, never
 * setState on the hot path" discipline the WebGL string field already
 * follows. Bind it directly to a style prop, e.g.
 * `style={{ skewX: useVelocitySkew() }}`.
 */
export function useVelocitySkew(scaleFactor = 0.4, max = 6): MotionValue<number> {
  const skew = useMotionValue(0);
  const reduced = useReducedMotion();
  const smoothed = React.useRef(0);

  useAnimationFrame(() => {
    if (reduced) return;
    smoothed.current += (scrollState.velocity - smoothed.current) * 0.1;
    skew.set(Math.max(-max, Math.min(max, smoothed.current * scaleFactor)));
  });

  return skew;
}

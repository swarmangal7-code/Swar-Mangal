"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

import { useCinematicMotion } from "@/lib/motion/use-cinematic-motion";

/**
 * A small circular cursor that expands slightly over anything interactive
 * (`a`, `button`, `[role="button"]`, or an explicit `data-cursor="hover"`).
 * Desktop pointer-fine only; native cursor stays untouched on touch. Reads
 * mouse position via a window-level listener rather than owning pointer
 * events itself, so it never competes with the WebGL string field or
 * anything else for hit-testing (same pattern as `CursorSpotlight`).
 */
export function CustomCursor() {
  const reduced = useCinematicMotion();
  const [active, setActive] = React.useState(false);
  const [hovering, setHovering] = React.useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 500, damping: 40, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 500, damping: 40, mass: 0.4 });

  React.useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setActive(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setActive(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  React.useEffect(() => {
    if (!active || reduced) return;
    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const el = e.target as Element | null;
      setHovering(Boolean(el?.closest('a, button, [role="button"], [data-cursor="hover"]')));
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [active, reduced, x, y]);

  if (!active || reduced) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[100] rounded-full border border-[#E2BD68]/70 mix-blend-difference"
      style={{
        x: sx,
        y: sy,
        translateX: "-50%",
        translateY: "-50%",
        width: hovering ? 40 : 16,
        height: hovering ? 40 : 16,
        transition: "width 0.2s ease, height 0.2s ease",
      }}
    />
  );
}

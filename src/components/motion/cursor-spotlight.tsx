"use client";

import * as React from "react";
import { useMotionValue, useSpring, motion, useReducedMotion } from "framer-motion";

/**
 * A soft warm light that follows the cursor over its parent — the same
 * "spotlight in a recital hall" idea the string field's pointer-pluck
 * expresses in 3D, echoed here in CSS. Tracks the cursor via a window-level
 * listener rather than its own pointer-events capture: this sits directly
 * above the WebGL canvas, and giving it pointer-events of its own would
 * intercept the mouse before the canvas ever saw it, breaking the string's
 * cursor-pluck interaction. `pointer-events-none` throughout — it only ever
 * watches, never intercepts. Off entirely on touch (no persistent cursor to
 * follow) and under reduced motion.
 */
export function CursorSpotlight() {
  const reduced = useReducedMotion();
  const [active, setActive] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);
  const sx = useSpring(x, { stiffness: 120, damping: 22, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 120, damping: 22, mass: 0.6 });

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
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      x.set(e.clientX - rect.left);
      y.set(e.clientY - rect.top);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [active, reduced, x, y]);

  if (reduced || !active) return null;

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      <motion.div
        className="absolute h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: sx,
          top: sy,
          background:
            "radial-gradient(circle, rgba(226,189,104,0.10) 0%, rgba(226,189,104,0.04) 40%, transparent 70%)",
        }}
      />
    </div>
  );
}

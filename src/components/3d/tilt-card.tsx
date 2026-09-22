"use client";

import * as React from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";

import { cn } from "@/lib/utils/cn";

function usePointerFine() {
  const [enabled, setEnabled] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setEnabled(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setEnabled(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return enabled;
}

/**
 * Subtle pointer-driven 3D tilt for hero surfaces only.
 * Disabled on touch devices and when reduced motion is requested.
 */
export function TiltCard({
  children,
  className,
  maxTilt = 5,
  glare = true,
  lift = 0,
}: {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glare?: boolean;
  /** Pixels to rise on hover, on top of the tilt — 0 disables it. */
  lift?: number;
}) {
  const reduced = useReducedMotion();
  const fine = usePointerFine();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const srx = useSpring(rx, { stiffness: 220, damping: 22, mass: 0.6 });
  const sry = useSpring(ry, { stiffness: 220, damping: 22, mass: 0.6 });
  const glareBg = useMotionTemplate`radial-gradient(520px circle at ${gx}% ${gy}%, rgba(255,255,255,0.12), transparent 42%)`;

  const active = fine && !reduced;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!active) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    ry.set(px * maxTilt * 2);
    rx.set(-py * maxTilt * 2);
    gx.set(((e.clientX - rect.left) / rect.width) * 100);
    gy.set(((e.clientY - rect.top) / rect.height) * 100);
  };

  const onLeave = () => {
    rx.set(0);
    ry.set(0);
    gx.set(50);
    gy.set(50);
  };

  if (!active) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div style={{ perspective: 1200 }} className={className}>
      <motion.div
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        whileHover={lift ? { y: -lift } : undefined}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{ rotateX: srx, rotateY: sry, transformStyle: "preserve-3d" }}
        className="group/tilt relative h-full w-full"
      >
        {children}
        {glare && (
          <motion.span
            aria-hidden
            style={{ background: glareBg }}
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/tilt:opacity-100"
          />
        )}
      </motion.div>
    </div>
  );
}

/** Wraps content that translates slightly toward the cursor (magnetic CTA). */
export function MagneticButton({
  children,
  className,
  strength = 6,
  radius = 90,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
  radius?: number;
}) {
  const reduced = useReducedMotion();
  const fine = usePointerFine();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.5 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!fine || reduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const dist = Math.hypot(dx, dy);
    const falloff = Math.max(0, 1 - dist / radius);
    x.set((dx / rect.width) * strength * 2 * falloff);
    y.set((dy / rect.height) * strength * 2 * falloff);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ x: sx, y: sy }}
      className={cn("inline-flex", className)}
    >
      {children}
    </motion.div>
  );
}
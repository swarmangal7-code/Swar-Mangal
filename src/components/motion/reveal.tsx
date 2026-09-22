"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";

import { EASE } from "@/lib/motion";
import { useCinematicMotion } from "@/lib/motion/use-cinematic-motion";
import { cn } from "@/lib/utils/cn";

/** Fades content up once it scrolls into view. No-op under reduced motion. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-64px 0px" });
  const reduced = useCinematicMotion();

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      // `initial` never branches on `reduced`: framer-motion's SSR only ever
      // renders the `initial` values as static inline styles, so branching
      // this on a value that's unresolved on the server (useReducedMotion is
      // null until the client's first effect) is a guaranteed hydration
      // mismatch for any visitor with the OS preference on. Reduced motion
      // is expressed by zeroing the transition instead, so it snaps to the
      // same `animate` target with no visible motion, never a differently
      // shaped server/client render.
      initial={{ opacity: 0, y: 26 }}
      animate={reduced || inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 26 }}
      transition={{ duration: reduced ? 0 : 0.7, ease: EASE, delay: reduced ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}
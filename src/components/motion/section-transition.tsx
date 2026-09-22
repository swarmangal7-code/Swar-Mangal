"use client";

import * as React from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

/**
 * Replaces a hard section cut with a continuous, scroll-scrubbed arrival:
 * the section settles from a slight scale/blur as it crosses into view,
 * rather than appearing at a fixed boundary. Scrubbed by the section's own
 * scroll position (`useScroll` + a target ref), not a one-time trigger —
 * scrolling back up un-settles it too, same as scrolling down settles it,
 * because it's driven by position, not an event.
 *
 * Deliberately coarser than `Reveal` (which still handles the one-time
 * per-item stagger inside each section): this is the section-as-a-whole's
 * relationship to its neighbours, not another pass over the same content.
 */
export function SectionTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // The ref useScroll targets must be attached on every render path from
  // the first paint — branching between a plain div and a motion.div (one
  // of which never attaches the ref) is exactly what makes Framer Motion
  // throw "target ref is defined but not hydrated". Always render the same
  // motion.div; reduced motion pins scale/opacity at their resting values
  // instead of removing the element that owns the ref.
  const ref = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.35"] });

  const scale = useTransform(scrollYProgress, [0, 1], reduced ? [1, 1] : [0.97, 1]);
  const opacity = useTransform(scrollYProgress, [0, 1], reduced ? [1, 1] : [0.55, 1]);

  return (
    <motion.div ref={ref} className={className} style={{ scale, opacity }}>
      {children}
    </motion.div>
  );
}

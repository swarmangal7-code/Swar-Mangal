"use client";

import * as React from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils/cn";

/**
 * Vertical scroll drives horizontal movement — desktop only. The outer
 * wrapper is made tall enough (viewport height + however wide the row
 * overflows) that scrolling through it pins the row via `sticky` and
 * translates it sideways instead of just scrolling past; once the row's
 * end reaches the viewport, the page continues scrolling normally into
 * whatever follows. Below the breakpoint (or under reduced motion, or
 * before the row's width is known) this renders as a plain native
 * horizontal-swipe list instead, via conditional styling rather than a
 * conditional DOM structure: `useScroll`'s target ref must always be
 * attached to a real node from the first render, on every path, or Framer
 * Motion throws "target ref is defined but not hydrated" — swapping
 * between two different element trees based on `enabled` state is exactly
 * how that regresses.
 */
export function HorizontalScroller({
  children,
  className,
  rowClassName,
}: {
  children: React.ReactNode;
  className?: string;
  rowClassName?: string;
}) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const rowRef = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [enabled, setEnabled] = React.useState(false);
  const [travel, setTravel] = React.useState(0);

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const measure = () => {
      if (!mq.matches || !rowRef.current) {
        setEnabled(false);
        return;
      }
      const overflow = rowRef.current.scrollWidth - window.innerWidth;
      setTravel(Math.max(overflow, 0));
      setEnabled(overflow > 40);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (rowRef.current) ro.observe(rowRef.current);
    mq.addEventListener?.("change", measure);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      mq.removeEventListener?.("change", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  const { scrollYProgress } = useScroll({ target: wrapperRef, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -travel]);

  const pinned = enabled && !reduced;

  return (
    <div ref={wrapperRef} className={className} style={pinned ? { height: `calc(100vh + ${travel}px)` } : undefined}>
      <div className={pinned ? "sticky top-0 flex h-screen items-center overflow-hidden" : undefined}>
        <motion.div
          ref={rowRef}
          className={
            pinned
              ? rowClassName
              : cn(
                  "flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  rowClassName,
                )
          }
          style={pinned ? { x } : undefined}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

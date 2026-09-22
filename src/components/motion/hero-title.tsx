"use client";

import { motion } from "framer-motion";

import { EASE } from "@/lib/motion";
import { useVelocitySkew } from "@/components/motion/text-reveal";

/**
 * The hero wordmark, entering as its own staged beat and carrying a faint
 * scroll-velocity skew — a fast flick past the hero stretches it a degree
 * or two, at rest it's dead still. Its own file (rather than a function
 * inside the Server Component page) because `useVelocitySkew` is a client
 * hook: calling it from a function defined in a Server Component module
 * fails at build time even though the module also has plenty of plain
 * Client Component children — the whole calling function needs its own
 * "use client" boundary, not just the hook it calls.
 */
export function HeroTitle() {
  const skew = useVelocitySkew(0.5, 5);
  return (
    <motion.h1
      className="font-display leading-none text-[#F7F2E8]"
      style={{ skewX: skew }}
      initial={{ opacity: 0, y: 34, filter: "blur(18px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 1.3, ease: EASE, delay: 0.15 }}
    >
      <span className="block text-[clamp(3.25rem,10vw,6.75rem)] tracking-[0.06em]">Swar</span>
      <span className="mt-2 block text-[clamp(3.25rem,10vw,6.75rem)] tracking-[0.06em] text-[#E2BD68]">
        Mangal
      </span>
    </motion.h1>
  );
}

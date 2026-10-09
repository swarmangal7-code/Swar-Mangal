"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";

import { useCinematicMotion } from "@/lib/motion/use-cinematic-motion";

const HOLD_MS = 650;

/**
 * A brief branded curtain, not a blocking spinner: the real page renders
 * underneath immediately (this is a purely decorative overlay), and it
 * never intercepts input even while visible — `pointer-events-none`
 * throughout, so a visitor who scrolls or taps during the ~1s hold isn't
 * blocked. Shown once per browser session (sessionStorage), not on every
 * reload, since this is a one-page site people will revisit within a
 * session via anchor links, not fresh navigations.
 */
export function LoadingScreen() {
  const reduced = useCinematicMotion();
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (reduced) return;
    try {
      if (sessionStorage.getItem("sm-loaded")) return;
      sessionStorage.setItem("sm-loaded", "1");
    } catch {
      // Storage unavailable (private mode, etc.) — just skip the curtain.
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), HOLD_MS);
    return () => clearTimeout(t);
  }, [reduced]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#08070B]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <motion.span
            className="font-display text-2xl text-[#E2BD68]"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            सा
          </motion.span>
          <motion.div
            className="mt-4 h-px w-16 bg-[#D6A84F]/60"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
          />
          <motion.p
            className="mt-4 text-[10px] font-bold uppercase tracking-[0.3em] text-[#A9A2B0]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            Swar Mangal
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

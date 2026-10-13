"use client";

import * as React from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The hero's signature object for the Dawn Parampara world: a rising sun
 * of soft marigold light — warm concentric glow over an ivory core, held
 * in a thin brass ring that wavers organically via the same SVG trick.
 * Breathes slowly via `.sm-ember` (opacity only, paused under
 * reduced-motion). Pure CSS/SVG — no WebGL, no new dependency, cheap
 * enough to run on every device tier.
 */
export function GlassOrb({ className }: { className?: string }) {
  // The hero mounts two suns (a desktop one beside the headline, a smaller
  // mobile one behind it, toggled with CSS visibility rather than
  // conditional mounting) — a shared literal filter id would collide, so
  // each instance gets its own via useId.
  const filterId = `sm-orb-wobble-${React.useId()}`;

  return (
    <div className={cn("relative", className)} aria-hidden>
      <svg width="0" height="0" className="absolute">
        <filter id={filterId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves={2} seed={7} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={14} />
        </filter>
      </svg>

      <div
        className="sm-ember absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 55%, rgba(255,252,244,0.98), rgba(255,244,220,0.85) 38%, rgba(232,197,124,0.45) 58%, transparent 74%)," +
            "radial-gradient(circle at 50% 50%, rgba(214,168,79,0.35), transparent 62%)," +
            "radial-gradient(circle at 34% 28%, rgba(255,255,255,0.9), rgba(255,255,255,0) 34%)",
          boxShadow:
            "inset 0 -14px 34px rgba(198,59,42,0.18), inset 0 10px 28px rgba(255,255,255,0.8), 0 0 110px -10px rgba(214,168,79,0.65), 0 30px 70px -30px rgba(110,32,24,0.4)",
        }}
      />
      <div
        className="absolute inset-0 rounded-full border opacity-90"
        style={{ borderColor: "rgba(154,116,34,0.6)", filter: `url(#${filterId})` }}
      />
      <div className="absolute inset-[30%] rounded-full bg-[#FFF6DF]/80 blur-xl" />
    </div>
  );
}

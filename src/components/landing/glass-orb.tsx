"use client";

import * as React from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The hero's signature object for the Midnight Raga world: an ember of
 * smoked glass — a diya-flame core (deep kumkum red into molten brass)
 * held in a dark refractive sphere with a thin gold rim light, breathing
 * slowly via `.sm-ember` (opacity only, paused under reduced-motion).
 * Layered radial-gradients plus `backdrop-filter` so it visibly refracts
 * the ember-black ground and field-lines behind it, finished with the same
 * SVG waver trick on the rim. Pure CSS/SVG — no WebGL, no new dependency,
 * cheap enough to run on every device tier.
 */
export function GlassOrb({ className }: { className?: string }) {
  // The hero mounts two orbs (a desktop one beside the headline, a smaller
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
            "radial-gradient(circle at 50% 58%, rgba(178,58,72,0.85), rgba(120,32,40,0.35) 42%, transparent 68%)," +
            "radial-gradient(circle at 50% 62%, rgba(232,197,124,0.9), rgba(214,168,79,0.35) 34%, transparent 60%)," +
            "radial-gradient(circle at 32% 24%, rgba(244,237,225,0.5), rgba(244,237,225,0.06) 30%, transparent 52%)," +
            "radial-gradient(circle at 50% 50%, rgba(46,26,20,0.9), rgba(14,11,9,0.4) 72%, rgba(14,11,9,0) 100%)",
          backdropFilter: "blur(2px) saturate(1.5)",
          WebkitBackdropFilter: "blur(2px) saturate(1.5)",
          boxShadow:
            "inset 0 12px 34px rgba(232,197,124,0.35), inset 0 -22px 44px rgba(0,0,0,0.65), 0 0 90px -12px rgba(214,168,79,0.55), 0 30px 70px -20px rgba(0,0,0,0.8)",
        }}
      />
      <div
        className="absolute inset-0 rounded-full border opacity-90"
        style={{ borderColor: "rgba(214,168,79,0.55)", filter: `url(#${filterId})` }}
      />
      <div className="absolute inset-[30%] rounded-full bg-[#E8C57C]/40 blur-xl" />
    </div>
  );
}

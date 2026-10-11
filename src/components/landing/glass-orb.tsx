"use client";

import * as React from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The hero's signature object: a glossy, refractive liquid-glass drop —
 * this world's translation of the incumbent site's "lit string" into
 * "lit glass." Built from layered radial-gradients (body colour, a hot
 * top-left specular highlight, a cooler rim light) plus
 * `backdrop-filter: blur() saturate()` so it visibly refracts the
 * grain-paper ground and field-lines behind it, finished with a thin SVG
 * `feTurbulence`/`feDisplacementMap` filter on the rim highlight for the
 * slight organic waver real glass has at its edge. Pure CSS/SVG — no
 * WebGL, no new dependency, cheap enough to run on every device tier.
 */
export function GlassOrb({ className }: { className?: string }) {
  // The hero mounts two GlassOrbs (a desktop one beside the headline, a
  // smaller mobile one behind it, toggled with CSS visibility rather than
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
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 26%, rgba(255,255,255,0.95), rgba(255,255,255,0.1) 32%, transparent 55%)," +
            "radial-gradient(circle at 68% 72%, rgba(214,168,79,0.5), transparent 58%)," +
            "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.55), rgba(246,244,239,0.25) 60%, rgba(21,20,26,0.08) 100%)",
          backdropFilter: "blur(2px) saturate(1.5)",
          WebkitBackdropFilter: "blur(2px) saturate(1.5)",
          boxShadow:
            "inset 0 10px 30px rgba(255,255,255,0.65), inset 0 -18px 36px rgba(214,168,79,0.25), 0 30px 70px -20px rgba(21,20,26,0.35)",
        }}
      />
      <div
        className="absolute inset-0 rounded-full border border-white/70 opacity-80"
        style={{ filter: `url(#${filterId})` }}
      />
      <div className="absolute inset-[18%] rounded-full bg-white/50 blur-xl" />
    </div>
  );
}

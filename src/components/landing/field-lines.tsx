"use client";

import { cn } from "@/lib/utils/cn";

/**
 * Thin flowing curved field-lines radiating from the glass-drop object —
 * the current site's "sound made visible" string motif, translated to 2D
 * ink-and-glass: brass/gold (#D6A84F, the incumbent's one accent) SVG
 * paths instead of a lit WebGL wire. Animated stroke-dashoffset under
 * `prefers-reduced-motion: no-preference` (`.sm-field-line` in
 * globals.css); with it on, the paths just render static and complete —
 * same drawing, zero motion, never a blank gap.
 */
export function FieldLines({ className }: { className?: string }) {
  const paths = [
    "M -40 260 C 160 160, 260 120, 430 140",
    "M -20 340 C 180 320, 300 230, 460 210",
    "M -10 420 C 200 440, 320 340, 470 280",
    "M 10 500 C 220 520, 330 420, 480 350",
    "M 30 170 C 190 90, 280 70, 420 95",
  ];
  return (
    <svg
      aria-hidden
      viewBox="0 0 520 560"
      className={cn("absolute", className)}
      fill="none"
    >
      {paths.map((d, i) => (
        <path
          key={d}
          d={d}
          className="sm-field-line"
          stroke="#D6A84F"
          strokeOpacity={0.45 - i * 0.04}
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

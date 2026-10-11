"use client";

import { cn } from "@/lib/utils/cn";

/**
 * One ragged, authored brush-edge shape per instrument — jjtheartist's
 * skill-bar motif translated into the academy's own six real instruments,
 * each owning one saturated colour as a material, never a decoration. The
 * ragged edge is a hand-authored SVG path (irregular, many control points,
 * genuinely wavering) painted as a filled shape, not a `clip-path` polygon
 * standing in for the effect and not a generic rounded rectangle.
 *
 * The raggedness is deliberately concentrated at the TOP and SIDE edges
 * (wobbling between y=0 and y=36 out of a 128-unit viewBox) while the
 * BOTTOM edge — where the instrument name/label sit, via `items-end` below
 * — stays within a shallow band (y=116 to 127, never higher than 116) for
 * the shape's full width. `preserveAspectRatio="none"` stretches this
 * viewBox non-uniformly onto whatever aspect-ratio box the card ends up
 * with, which amplifies any gap in the bottom band far more than one in
 * the top band; a previous version raggedised the bottom too and left the
 * label sitting outside the painted area on 5 of 6 cards (only the one
 * card whose text happened to be short/narrow enough stayed inside by
 * chance). Keeping the bottom ~8% of the shape's height solid guarantees
 * the label — inset by real padding below — always lands on the painted
 * colour, not the cream page background, regardless of card size or
 * instrument-name length.
 */
const RAGGED_PATH =
  "M0,34 C40,8 100,0 160,12 C220,24 290,2 352,16 " +
  "C352,40 346,90 352,122 " +
  "C300,127 240,119 180,124 C120,127 60,118 0,123 " +
  "C-2,100 -2,60 0,34 Z";

export function PaintStroke({
  color,
  ink,
  name,
  label,
  className,
}: {
  color: string;
  /** Text colour chosen per-swatch for contrast — never a flat gray-on-hue. */
  ink: string;
  name: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("relative flex aspect-[4/3] w-full items-end overflow-hidden rounded-[2px]", className)}>
      <svg
        viewBox="0 0 352 128"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <path d={RAGGED_PATH} fill={color} />
      </svg>
      <div className="relative z-10 flex w-full flex-col gap-1 p-6 sm:p-7" style={{ color: ink }}>
        <h3 className="font-display text-2xl font-extrabold leading-none sm:text-3xl">{name}</h3>
        <span className="text-xs font-semibold uppercase tracking-[0.14em] opacity-90">{label}</span>
      </div>
    </div>
  );
}

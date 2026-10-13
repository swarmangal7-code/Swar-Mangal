"use client";

import * as React from "react";
import { motion } from "framer-motion";

/**
 * The literal "liquidGL" interaction from stackht.pages.dev: a draggable
 * circular glass lens the visitor drags across the hero/courses ground to
 * see it refract. CSS `backdrop-filter: blur() saturate()` does the
 * refractive blur; an SVG `feTurbulence`/`feDisplacementMap` filter
 * (`#sm-lens-distort`, referenced from `.sm-lens-glass` in globals.css)
 * warps what's underneath so it reads as glass, not a flat blur card. That
 * class lives on an inner element, not this draggable wrapper — see the
 * comment at the `.sm-lens-glass` div below.
 *
 * Direct pointer-driven dragging isn't the kind of autoplay motion
 * `prefers-reduced-motion` targets, so the lens stays draggable either
 * way; what's disabled under that preference is only the elastic
 * spring-back feel (`dragElastic`/`dragTransition`), so a reduced-motion
 * visitor gets a lens that moves exactly where they put it, no bounce.
 */
export function GlassLens({
  containerRef,
  reducedMotion,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  reducedMotion: boolean;
}) {
  const [picked, setPicked] = React.useState(false);
  const lensRef = React.useRef<HTMLDivElement>(null);
  // framer-motion's `dragConstraints` normally takes a ref directly and
  // re-measures it through its own layout-projection system. That system
  // ties the lens's position to the CONTAINER'S viewport-relative
  // bounding box at measurement time — fine while the page sits at
  // scrollTop 0, but it re-measures (via a shared layout pass triggered
  // by the page's OTHER motion components — `Reveal`/`SectionTransition`
  // — reacting to scroll) using the container's rect at whatever scroll
  // position that pass runs at, then reprojects the lens using that
  // now-stale, viewport-relative box. The lens itself is positioned in
  // normal document flow, so this reprojection silently transformed it
  // off to an unrelated position — rendering as "invisible" on any
  // capture taken after the page had been scrolled, confirmed by
  // comparing computed styles (opacity 1, display block, present in the
  // DOM) against where it actually painted. Computing a plain numeric
  // `{top,left,right,bottom}` constraints object ourselves — once on
  // mount/resize, from the SAME `getBoundingClientRect` math
  // framer-motion uses internally — gets the identical clamping behaviour
  // without opting into that ref-based re-measurement/reprojection path.
  const [constraints, setConstraints] = React.useState({ top: 0, left: 0, right: 0, bottom: 0 });

  React.useEffect(() => {
    function measure() {
      const container = containerRef.current;
      const lens = lensRef.current;
      if (!container || !lens) return;
      const c = container.getBoundingClientRect();
      const l = lens.getBoundingClientRect();
      setConstraints({
        left: c.left - l.left,
        right: c.right - l.right,
        top: c.top - l.top,
        bottom: c.bottom - l.bottom,
      });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [containerRef]);

  return (
    <>
      <svg width="0" height="0" className="absolute">
        <filter id="sm-lens-distort">
          <feTurbulence type="fractalNoise" baseFrequency="0.01 0.018" numOctaves={2} seed={3} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={26} />
        </filter>
      </svg>

      <motion.div
        ref={lensRef}
        role="button"
        tabIndex={0}
        aria-label="Drag the glass lens to look closer"
        drag
        dragConstraints={constraints}
        dragElastic={reducedMotion ? 0 : 0.12}
        dragTransition={reducedMotion ? { power: 0 } : { power: 0.2, timeConstant: 180 }}
        dragMomentum={!reducedMotion}
        onPointerDown={() => setPicked(true)}
        onPointerUp={() => setPicked(false)}
        whileDrag={{ scale: 1.04 }}
        // Mobile/tablet (<lg, single-column hero): anchored to the LEFT of
        // the hero, clear of the small mobile orb (which is right-anchored,
        // `-right-10 top-24` in `hero-stage.tsx`) at every width this
        // layout covers (390–1023px) — a right-anchored lens position here
        // previously sat close enough to the right-anchored orb to read as
        // one fused blob instead of two distinct objects. Desktop (lg+,
        // two-column hero): `lg:left-auto` hands horizontal positioning
        // back to `right`, resting below-left of the large orb with a
        // real gap (orb occupies roughly the top 60% of its column; the
        // lens sits in the bottom third) rather than overlapping it.
        className="absolute left-6 top-20 z-20 h-16 w-16 cursor-grab touch-none rounded-full active:cursor-grabbing lg:left-auto lg:right-[22%] lg:top-[72%] lg:h-28 lg:w-28"
        style={{ touchAction: "none" }}
      >
        {/* The glass look lives on this INNER element, sized to fill the
            draggable parent — `filter` (unlike `backdrop-filter`) distorts
            an element's own rendered output INCLUDING its children, so an
            earlier version that put the tooltip `<span>` inside the same
            filtered element rendered the tooltip's own glyphs warped and
            fused together. Keeping the filtered glass surface and the
            tooltip as siblings (not parent/child) means only the glass
            surface warps; the tooltip text stays crisp. */}
        <div className="sm-lens-glass pointer-events-none absolute inset-0 rounded-full" />
        <span
          className="sm-telemetry pointer-events-none absolute top-full left-0 mt-3 w-[9.5rem] rounded-xl border border-[#D6A84F]/30 bg-black/70 px-3 py-1.5 text-center text-[11px] font-medium leading-snug text-[#E8C57C] backdrop-blur-md transition-opacity lg:left-1/2 lg:w-max lg:max-w-none lg:-translate-x-1/2 lg:rounded-full lg:py-1"
          style={{ opacity: picked ? 0 : 1 }}
        >
          Drag the glass lens to look closer
        </span>
      </motion.div>
    </>
  );
}

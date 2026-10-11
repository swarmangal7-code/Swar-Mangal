"use client";

import * as React from "react";

import { PillNav } from "@/components/landing/pill-nav";
import { GlassOrb } from "@/components/landing/glass-orb";
import { FieldLines } from "@/components/landing/field-lines";
import { GlassLens } from "@/components/landing/glass-lens";
import { PrimaryButton, GhostButton } from "@/components/landing/section";

/**
 * First viewport, per the direction contract: pill nav, big two-line
 * headline left-aligned mid-height, the glass-drop object right-of-centre
 * with field-lines flowing from it, one sentence of real fact, a solid
 * pill CTA beside an outlined one, a status pill below, and the draggable
 * glass lens overlaid on the whole stage.
 */
export function HeroStage() {
  const stageRef = React.useRef<HTMLElement>(null);
  // This page doesn't gate its motion on the OS preference (see
  // `useCinematicMotion`'s own note — it's a constant for the cinematic
  // dark world this page used to be); for the new world's one draggable
  // toy we still want to honour a true reduced-motion visitor's intent for
  // the spring/bounce *feel* specifically, so read the real media query
  // directly here rather than importing a hook that always says "false".
  const [reducedMotion, setReducedMotion] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return (
    <section
      id="top"
      ref={stageRef}
      className="relative isolate flex min-h-[100svh] flex-col overflow-hidden"
    >
      <PillNav />

      <div className="relative z-10 mx-auto flex w-full max-w-[88rem] flex-1 flex-col justify-center px-6 pb-16 pt-28 sm:px-8 md:pt-32">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            {/* Two short clauses either side of the comma, each kept to
                ~13 characters — the direction contract's FIRST VIEWPORT
                promise is a two-line headline at both desktop and mobile.
                Two things conspired against that on earlier drafts: Syne's
                geometric letterforms run wide per character even at modest
                sizes, and the two-column grid below (`lg:grid-cols-...`)
                makes the text column actually SHRINK right at the `lg`
                breakpoint before growing again as the viewport widens past
                it — a flat `sm:→md:→` size ramp that only ever grows
                doesn't account for that dip, so a size tuned to look right
                at 1440px/`xl` could still overflow right at 1024px/`lg`.
                `lg:text-5xl` explicitly steps the size back down for that
                narrower two-column zone, then `xl:text-6xl` grows it again
                once the column has real room. Verified by direct render at
                1440 (desktop) and 390 (mobile) — the two widths this
                surface is actually reviewed at. */}
            <h1 className="font-display text-3xl font-extrabold leading-[0.98] tracking-tight text-[#15141A] sm:text-6xl lg:text-5xl xl:text-6xl">
              Sound, taught
              <br />
              one-to-one.
            </h1>
            <p className="mt-7 max-w-md text-base leading-relaxed text-[#15141A]/65 sm:text-lg">
              Two Mumbai studios, six instruments, every lesson taught one-to-one — guitar, piano,
              vocal, tabla, violin and flute.
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <PrimaryButton href="/login">Enroll now</PrimaryButton>
              <GhostButton href="#courses">Browse courses</GhostButton>
            </div>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#15141A]/10 bg-white/60 px-4 py-2 text-xs font-semibold text-[#15141A]/70 backdrop-blur-md">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Open for enrollment — Goregaon &amp; Kandivali
            </div>
          </div>

          <div className="relative mx-auto hidden h-[26rem] w-full max-w-md lg:block" aria-hidden>
            <FieldLines className="inset-0 h-full w-full text-[#D6A84F]" />
            <GlassOrb className="absolute right-6 top-10 h-56 w-56 xl:h-64 xl:w-64" />
          </div>
        </div>
      </div>

      {/* Mobile/tablet: the orb sits as a smaller standalone flourish behind
          the headline rather than beside it, so the two-line headline keeps
          its full width down to narrow viewports. */}
      <GlassOrb className="pointer-events-none absolute -right-10 top-24 h-40 w-40 opacity-80 lg:hidden" />

      <GlassLens containerRef={stageRef} reducedMotion={reducedMotion} />
    </section>
  );
}

"use client";

import * as React from "react";

import { PillNav } from "@/components/landing/pill-nav";
import { GlassOrb } from "@/components/landing/glass-orb";
import { FieldLines } from "@/components/landing/field-lines";
import { GlassLens } from "@/components/landing/glass-lens";
import { PrimaryButton, GhostButton } from "@/components/landing/section";

/**
 * First viewport for the Midnight Raga world: pill nav, big two-line
 * Fraunces headline left-aligned mid-height, the ember orb right-of-centre
 * with gold field-lines flowing from it, one sentence of real fact, a
 * brass pill CTA beside an outlined one, a mono telemetry strip below
 * (branch codes · disciplines · format — real facts only, never invented
 * numbers), and the draggable glass lens overlaid on the whole stage.
 */
export function HeroStage() {
  const stageRef = React.useRef<HTMLElement>(null);
  // Direct pointer-driven dragging isn't the kind of autoplay motion
  // `prefers-reduced-motion` targets, so the lens stays draggable either
  // way; what's disabled under that preference is only the elastic
  // spring-back feel — read the real media query directly here.
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
      {/* Ember ambience: a low warm glow behind the orb column plus a top
          vignette so the nav pill sits in lamplight, not flat black. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(52rem 30rem at 78% 42%, rgba(178,58,72,0.16), transparent 62%)," +
            "radial-gradient(44rem 26rem at 72% 46%, rgba(214,168,79,0.13), transparent 60%)," +
            "linear-gradient(180deg, rgba(0,0,0,0.45), transparent 26%)",
        }}
      />
      <PillNav />

      <div className="relative z-10 mx-auto flex w-full max-w-[88rem] flex-1 flex-col justify-center px-6 pb-16 pt-28 sm:px-8 md:pt-32">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            {/* Two short clauses either side of the comma, each kept to
                ~13 characters — the FIRST VIEWPORT promise is a two-line
                headline at both desktop and mobile. Fraunces runs narrower
                per character than the old geometric grotesk, so the same
                size ramp (with the lg dip for the narrower two-column zone,
                growing again at xl) holds the two lines with room to spare. */}
            <h1 className="font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight text-[#F4EDE1] sm:text-6xl lg:text-5xl xl:text-6xl">
              Sound, taught
              <br />
              <em className="font-medium text-[#E8C57C]">one-to-one.</em>
            </h1>
            <p className="mt-7 max-w-md text-base leading-relaxed text-[#F4EDE1]/65 sm:text-lg">
              Two Mumbai studios, six instruments, every lesson taught one-to-one — guitar, piano,
              vocal, tabla, violin and flute.
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <PrimaryButton href="/login">Enroll now</PrimaryButton>
              <GhostButton href="#courses">Browse courses</GhostButton>
            </div>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#D6A84F]/25 bg-[#D6A84F]/[0.07] px-4 py-2 text-xs font-semibold text-[#E8C57C] backdrop-blur-md">
              <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#D6A84F]" />
              Open for enrollment — Goregaon &amp; Kandivali
            </div>
            <p className="sm-telemetry mt-8 text-[11px] uppercase leading-loose tracking-[0.22em] text-[#F4EDE1]/40">
              KND · GGN <span aria-hidden className="mx-2 text-[#D6A84F]/60">/</span> 06 disciplines{" "}
              <span aria-hidden className="mx-2 text-[#D6A84F]/60">/</span> 1:1 every lesson
            </p>
          </div>

          <div className="relative mx-auto hidden h-[26rem] w-full max-w-md lg:block" aria-hidden>
            <FieldLines className="inset-0 h-full w-full text-[#D6A84F] drop-shadow-[0_0_12px_rgba(214,168,79,0.45)]" />
            <GlassOrb className="absolute right-6 top-10 h-56 w-56 xl:h-64 xl:w-64" />
          </div>
        </div>
      </div>

      {/* Mobile/tablet: the ember sits as a smaller standalone flourish behind
          the headline rather than beside it, so the two-line headline keeps
          its full width down to narrow viewports. */}
      <GlassOrb className="pointer-events-none absolute -right-10 top-24 h-40 w-40 opacity-80 lg:hidden" />

      <GlassLens containerRef={stageRef} reducedMotion={reducedMotion} />
    </section>
  );
}

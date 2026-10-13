"use client";

import * as React from "react";

import { PillNav } from "@/components/landing/pill-nav";
import { GlassOrb } from "@/components/landing/glass-orb";
import { FieldLines } from "@/components/landing/field-lines";
import { GlassLens } from "@/components/landing/glass-lens";
import { PrimaryButton, GhostButton } from "@/components/landing/section";

/**
 * First viewport for the Dawn Parampara world: pill nav, tanpura drone
 * strings behind everything, a giant सा watermark beside a rising-sun
 * orb, big two-line Fraunces headline left-aligned mid-height, one
 * sentence of real fact, a maroon pill CTA beside an outlined one, a
 * mono telemetry strip below (branch codes · disciplines · format —
 * real facts only, never invented numbers), and the draggable glass
 * lens overlaid on the whole stage.
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
      {/* Dawn ambience: marigold glow along the top (first light), a warm
          wash rising from below, and the tanpura drone strings across the
          whole stage. All static CSS — no motion to gate. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 26rem at 50% -6rem, rgba(214,168,79,0.4), transparent 62%)," +
            "radial-gradient(50rem 30rem at 82% 44%, rgba(214,168,79,0.16), transparent 60%)," +
            "linear-gradient(180deg, rgba(255,252,244,0.5), transparent 30%, transparent 72%, rgba(198,59,42,0.06))",
        }}
      />
      <div aria-hidden className="sm-strings pointer-events-none absolute inset-0 opacity-70" />
      <PillNav />

      <div className="relative z-10 mx-auto flex w-full max-w-[88rem] flex-1 flex-col justify-center px-6 pb-16 pt-28 sm:px-8 md:pt-32">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            {/* Two short clauses either side of the comma, each kept short
                so the FIRST VIEWPORT promise — a two-line headline at both
                desktop and mobile — holds without breakpoint-by-breakpoint
                tuning. Fraunces runs narrower than the old grotesk, with
                room to spare. */}
            <h1 className="font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight text-[#2A1512] sm:text-6xl lg:text-5xl xl:text-6xl">
              Sound, taught
              <br />
              <em className="text-[#6E2018]">one-to-one.</em>
            </h1>
            <p className="mt-7 max-w-md text-base leading-relaxed text-[#2A1512]/65 sm:text-lg">
              Two Mumbai studios, six instruments, every lesson taught one-to-one — guitar, piano,
              vocal, tabla, violin and flute.
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <PrimaryButton href="/login">Enroll now</PrimaryButton>
              <GhostButton href="#courses">Browse courses</GhostButton>
            </div>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#C63B2A]/25 bg-[#C63B2A]/[0.06] px-4 py-2 text-xs font-semibold text-[#8F2B1E] backdrop-blur-md">
              <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C63B2A]" />
              Open for enrollment — Goregaon &amp; Kandivali
            </div>
            <p className="sm-telemetry mt-8 text-[11px] uppercase leading-loose tracking-[0.22em] text-[#2A1512]/45">
              KND · GGN <span aria-hidden className="mx-2 text-[#9A7422]/70">/</span> 06 disciplines{" "}
              <span aria-hidden className="mx-2 text-[#9A7422]/70">/</span> 1:1 every lesson
            </p>
          </div>

          <div className="relative mx-auto hidden h-[26rem] w-full max-w-md lg:block" aria-hidden>
            <span className="sm-dev pointer-events-none absolute -left-8 top-2 select-none text-[11rem] font-normal leading-none text-[#6E2018]/[0.08]">
              सा
            </span>
            <FieldLines className="inset-0 h-full w-full text-[#9A7422]" />
            <GlassOrb className="absolute right-6 top-10 h-56 w-56 xl:h-64 xl:w-64" />
          </div>
        </div>
      </div>

      {/* Mobile/tablet: the sun sits as a smaller standalone flourish behind
          the headline rather than beside it, so the two-line headline keeps
          its full width down to narrow viewports. */}
      <GlassOrb className="pointer-events-none absolute -right-10 top-24 h-40 w-40 opacity-80 lg:hidden" />

      <GlassLens containerRef={stageRef} reducedMotion={reducedMotion} />
    </section>
  );
}

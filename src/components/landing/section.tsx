"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { SectionTransition } from "@/components/motion/section-transition";
import { cn } from "@/lib/utils/cn";

export function PrimaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#6E2018] px-7 py-3.5 text-sm font-semibold text-[#F7F1E5] shadow-[0_10px_30px_-10px_rgba(110,32,24,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#82281D] active:translate-y-0"
    >
      <span>{children}</span>
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export function GhostButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#2A1512]/20 px-7 py-3.5 text-sm font-semibold text-[#2A1512] transition-colors duration-300 hover:border-[#9A7422]/60 hover:text-[#7A5A1A]"
    >
      {children}
    </Link>
  );
}

/** The recurring motif between sections — a gold hairline, at rest. */
export function InkDivider() {
  return <div aria-hidden className="sm-glow-line h-px w-full" />;
}

export function Section({
  id,
  tint,
  band,
  children,
}: {
  id: string;
  tint?: string;
  /** Full-bleed background band for the dawn crescendo rhythm. */
  band?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("relative", band)}>
      <InkDivider />
      <SectionTransition className={cn("relative z-10 mx-auto w-full max-w-[88rem] px-6 py-20 md:py-28", tint)}>
        {children}
      </SectionTransition>
    </section>
  );
}

export function SectionHeading({ title, blurb }: { title: string; blurb?: string }) {
  return (
    <Reveal>
      <div className="mb-14 max-w-2xl md:mb-20">
        <h2 className="font-display text-3xl font-semibold leading-[1.1] tracking-tight text-[#2A1512] md:text-[2.75rem]">
          {title}
        </h2>
        {blurb && <p className="mt-4 text-[15px] leading-relaxed text-[#2A1512]/60">{blurb}</p>}
      </div>
    </Reveal>
  );
}

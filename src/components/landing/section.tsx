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
      className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#D6A84F] px-7 py-3.5 text-sm font-semibold text-[#17100A] shadow-[0_8px_30px_-8px_rgba(214,168,79,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#E8C57C] active:translate-y-0"
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
      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#F4EDE1]/20 px-7 py-3.5 text-sm font-semibold text-[#F4EDE1] transition-colors duration-300 hover:border-[#D6A84F]/60 hover:text-[#E8C57C]"
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
  children,
}: {
  id: string;
  tint?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="relative">
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
        <h2 className="font-display text-3xl font-semibold leading-[1.1] tracking-tight text-[#F4EDE1] md:text-[2.75rem]">
          {title}
        </h2>
        {blurb && <p className="mt-4 text-[15px] leading-relaxed text-[#F4EDE1]/60">{blurb}</p>}
      </div>
    </Reveal>
  );
}

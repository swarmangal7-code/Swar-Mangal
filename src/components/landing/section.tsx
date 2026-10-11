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
      className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#15141A] px-7 py-3.5 text-sm font-semibold text-[#F6F4EF] transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0"
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
      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#15141A]/20 px-7 py-3.5 text-sm font-semibold text-[#15141A] transition-colors duration-300 hover:border-[#15141A]/50"
    >
      {children}
    </Link>
  );
}

/** The recurring motif between sections — a hairline ink rule, at rest. */
export function InkDivider() {
  return (
    <div
      aria-hidden
      className="h-px w-full bg-[linear-gradient(90deg,transparent_0%,rgba(21,20,26,0.12)_50%,transparent_100%)]"
    />
  );
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
        <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-[#15141A] md:text-4xl">
          {title}
        </h2>
        {blurb && <p className="mt-4 text-[15px] leading-relaxed text-[#15141A]/65">{blurb}</p>}
      </div>
    </Reveal>
  );
}

"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * First-viewport chrome from the direction contract: a pill nav badge
 * top-left ("Swar Mangal · Mumbai") and a small circular icon button
 * top-right (→ login). Not a full nav bar — the hero's own CTAs carry
 * navigation weight, this is identity + one affordance.
 */
export function PillNav() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8">
      <span className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[#15141A]/10 bg-white/70 px-4 py-2 text-xs font-semibold tracking-wide text-[#15141A] shadow-[0_1px_2px_rgba(21,20,26,0.04)] backdrop-blur-md">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#D6A84F]" />
        Swar Mangal · Mumbai
      </span>
      <Link
        href="/login"
        aria-label="Student / staff login"
        className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#15141A]/10 bg-white/70 text-[#15141A] shadow-[0_1px_2px_rgba(21,20,26,0.04)] backdrop-blur-md transition-transform hover:-translate-y-0.5 hover:text-[#15141A]"
      >
        <ArrowUpRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

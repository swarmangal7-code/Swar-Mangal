"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * First-viewport chrome: a smoked-glass pill badge top-left
 * ("Swar Mangal · Mumbai", mono telemetry voice) and a small circular
 * icon button top-right (→ login). Not a full nav bar — the hero's own
 * CTAs carry navigation weight, this is identity + one affordance.
 */
export function PillNav() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8">
      <span className="sm-telemetry pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#F4EDE1]/85 shadow-[0_1px_2px_rgba(0,0,0,0.4)] backdrop-blur-md">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#D6A84F] shadow-[0_0_8px_rgba(214,168,79,0.9)]" />
        Swar Mangal · Mumbai
      </span>
      <Link
        href="/login"
        aria-label="Student / staff login"
        className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[#F4EDE1] shadow-[0_1px_2px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-[#D6A84F]/50 hover:text-[#E8C57C]"
      >
        <ArrowUpRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";

const LINKS = [
  { href: "#about", label: "About" },
  { href: "#courses", label: "Courses" },
  { href: "#experience", label: "Experience" },
  { href: "#faculty", label: "Faculty" },
  { href: "#branches", label: "Find Us" },
] as const;

/**
 * Fixed above everything (not embedded in the hero, which would scroll it
 * away): transparent over the hero, gaining a dark blurred surface once
 * the visitor scrolls past it, with the current section picked up by
 * IntersectionObserver and underlined in gold — reading position, never
 * driving it.
 */
export function SiteNav() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = React.useState(false);
  const [active, setActive] = React.useState<string>("");

  useMotionValueEvent(scrollY, "change", (v) => setSolid(v > 80));

  React.useEffect(() => {
    const sections = LINKS.map((l) => document.getElementById(l.href.slice(1))).filter(
      (el): el is HTMLElement => Boolean(el),
    );
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(`#${visible[0].target.id}`);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <motion.nav
      aria-label="Primary"
      className="fixed inset-x-0 top-0 z-30 border-b transition-colors duration-500"
      animate={{
        backgroundColor: solid ? "rgba(8,7,11,0.82)" : "rgba(8,7,11,0)",
        borderColor: solid ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0)",
        backdropFilter: solid ? "blur(14px)" : "blur(0px)",
      }}
      transition={{ duration: 0.4 }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="#top" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D6A84F]/40 bg-[#D6A84F]/10 font-display text-sm font-semibold text-[#E2BD68]">
            S
          </span>
          <span className="font-display text-lg tracking-[0.08em] text-[#F7F2E8]">Swar Mangal</span>
        </Link>
        <div className="hidden items-center gap-8 text-sm text-[#A9A2B0] lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative py-1 transition-colors hover:text-[#E2BD68]"
              style={{ color: active === l.href ? "#E2BD68" : undefined }}
            >
              {l.label}
              {active === l.href && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-x-0 -bottom-1 h-px bg-[#E2BD68]"
                  transition={{ duration: 0.3 }}
                />
              )}
            </a>
          ))}
        </div>
        <Link
          href="/login"
          className="rounded-full border border-[#F7F2E8]/20 px-4 py-1.5 text-sm text-[#F7F2E8] transition-colors hover:border-[#D6A84F]/60 hover:text-[#E2BD68]"
        >
          Login
        </Link>
      </div>
    </motion.nav>
  );
}

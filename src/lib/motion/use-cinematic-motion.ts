"use client";

/**
 * The landing page is a marketing surface, not a tool people operate daily
 * (unlike the dashboards, which correctly call framer-motion's own
 * `useReducedMotion()` and respect it). Its WebGL hero, staged reveals and
 * scroll choreography ARE the product here — per explicit product decision,
 * this page always plays its full cinematic treatment regardless of the
 * visitor's OS-level `prefers-reduced-motion` preference, rather than
 * silently degrading to a static line for anyone whose OS/browser has that
 * flag on (which was happening, and reads as "the site is broken" rather
 * than "the site is respecting an accessibility setting").
 *
 * A constant `false` — not a hook that reads anything — so it can never
 * disagree between server and client render and can never cause a
 * hydration mismatch, unlike framer-motion's own `useReducedMotion()`
 * (which is `null` until the client's first effect).
 */
export function useCinematicMotion(): false {
  return false;
}

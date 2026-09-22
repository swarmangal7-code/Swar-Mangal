# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences on one Next.js site:
- **Prospective students and their parents** in Mumbai, evaluating whether to
  enroll (or enroll their child) in music lessons — the landing page's job.
- **Founder and staff** of the academy, who log in from the same site to a
  web counterpart of the Flutter app's founder/staff dashboards (students,
  fees/receipts, attendance, timetable, inquiries, teacher payouts, etc.).

## Product Purpose

Swar Mangal is a real, operating music academy in Mumbai with two physical
branches (Goregaon, Kandivali) teaching guitar, piano/keys, vocal, tabla,
violin and flute — one-to-one lessons, not group classes by default. The
public site markets real lessons at real branches; success is a visitor
enrolling. The founder/staff web dashboards mirror the Flutter app so the
same people can operate the academy (money, students, attendance) from a
browser, not just the phone app.

## Positioning

A serious, disciplined, one-to-one teaching practice — not a hobby class or
a franchise crammer. Teachers are working musicians who still perform, not
just instructors. Classical rigor (Hindustani vocal, tabla layakari) sits
alongside contemporary/Western instruments, taught by the same standard.

## Operating Context

Real business data lives in Postgres and is exposed to the Flutter app and
this website's founder/staff dashboards through the same RPC gateway
(`/api/rpc`); see the codebase's own `deploy/README.md` for the production
architecture (aaPanel VPS backend + this Next.js site as a separate deploy
on Cloudflare Pages calling that VPS over CORS). The landing page itself is
static marketing content with no data dependency.

## Capabilities and Constraints

- Two branches only: Goregaon and Kandivali, Mumbai. Do not imply more
  locations or a chain/franchise model.
- Instruments currently taught (per existing copy): guitar, piano/keys,
  vocal, tabla, violin, flute.
- Lessons are one-to-one by default (a stated differentiator) — copy should
  not accidentally imply group-class-first.
- The site must run as a Cloudflare Pages static export (no server API
  routes in that build) — any interactive/3D work on the landing page must
  be pure client-side, no server dependency.
- Audience skews toward mobile, on a range of device tiers common in Mumbai
  — heavy WebGL/3D work must degrade gracefully (or disable) on low-end
  phones and under `prefers-reduced-motion`, not just on desktop.

## Brand Commitments

- Name: **Swar Mangal** ("सा" — the tonic/Sa — used as a recurring visual
  motif in the current design).
- Existing landing page already establishes a dark, warm-gold/amber-on-near-
  black palette (`#08070B` / `#D6A84F` / `#E2BD68` / `#F7F2E8`) with a serif
  display face for headings — evidence of an intentional premium-editorial
  direction already in place, not yet a locked DESIGN.md.
- User's explicit binding visual reference for this redesign: **lenis.dev**
  (Studio Freight / darkroom.engineering's own site) — specifically its
  scroll smoothness/physics and its 3D/WebGL interaction work. Recorded as
  given, not expanded here; new-work.md resolves what that means concretely
  for this brand.

## Evidence on Hand

- No real photography, faculty headshots, or a logo file yet — proceeding
  with placeholder/abstract visuals (current approach: instrument-initial
  cards, geometric "सा" motif) until the founder provides real assets.
- No testimonials, press, or enrollment numbers on hand — none should be
  fabricated.

## Product Principles

1. The landing page sells real lessons to real people — every claim must
   stay true to an actual two-branch, one-to-one teaching practice.
2. Premium and smooth in feel, but never at the cost of a parent on a
   mid-range Android phone being able to read it and tap "enroll."
3. The founder/staff web dashboards are functional tools (Operate mode);
   the landing page is a persuasion surface (Persuade mode) — they can share
   a visual language but are judged by different standards.
4. Placeholder content stays honest-looking (abstract/iconographic), never
   fake-specific (no invented names, photos, or numbers standing in for real
   ones).

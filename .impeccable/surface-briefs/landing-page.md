# Surface brief: `src/app/page.tsx` (public landing page)

Scope: the marketing landing page only (Hero → About → Courses → Experience
→ Faculty → Branches → CTA → Footer). Visitor mode: **Persuade**. Founder/
staff web dashboards elsewhere in the site are Operate and out of scope.

Audience: parents and prospective students in Mumbai deciding whether to
enroll at Goregaon or Kandivali. Job: believe this is a serious, disciplined,
one-to-one teaching practice worth real money and weekly commitment, then
act (enroll / log in).

Constraints: static Cloudflare Pages export (no server dependency in this
surface); must degrade gracefully on mid/low-end Android under
`prefers-reduced-motion`; no fabricated testimonials/photos — placeholder
content stays abstract, never fake-specific.

User-pinned visual references: lenis.dev (Studio Freight/darkroom.engineering)
— scroll-physics smoothness and WebGL 3D interaction — plus, added in a
follow-up round, lusion.co (Lusion studio) — full cinematic scene work:
volumetric light/bloom, particle atmosphere, camera movement, film-grade
polish. Direction below translates both mechanisms into this brand rather
than copying either's content. The follow-up round's explicit ask ("premium
like lenis.dev and lusion.co, cinematic experience, 3D animations, premium
interactions, musical vibe") is why the build now includes bloom, a
particle/note field, a cursor spotlight, a scroll-tied camera dolly, and a
whole-page grain/vignette layer on top of the original string.

## Direction contract

**THESIS** — A music academy's landing page always ships the same page:
eyebrow-labelled sections, a grid of icon+heading+text cards, a 3-stat hero
band, gold-on-black "premium" gradient dressing. This surface refuses all
four. Its one idea: scrolling itself becomes the demonstration — sound made
visible, physically, the moment the page loads, not illustrated after an
eyebrow label introduces it.

**OWN-WORLD** — Near-black stage-lit ground (`#08070B`/`#0E0C12`, unchanged —
already the right scene: a recital hall, not a SaaS dashboard). Warm brass/
string-metal gold (`#D6A84F`/`#E2BD68`) as a functional material — a real
string, a resonance ring, a tuning peg — never a text gradient or decorative
glow alone. Display face: a high-contrast serif with real character
(Fraunces) for headlines; a precise, slightly technical sans (Space Grotesk)
for functional labels, replacing every uppercase-tracked eyebrow. Concert-
program logic: centered hairline rules, generous margins, no card grids.

**STORY** — Visitor lands, sees/feels a single physical string resonate
across the screen in real time, reacting to their scroll and cursor exactly
like a played instrument — believes within 2 seconds "this place understands
sound as a physical thing," reads the academy's actual claims (two branches,
one-to-one, six instruments, real faculty who perform), and enrolls or logs
in.

**FIRST VIEWPORT** — Full-bleed WebGL canvas: one lit string/wire spanning
the viewport, at rest under ambient sway, plucking toward the cursor on
hover and gaining amplitude with scroll velocity. "Swar Mangal" wordmark
(Fraunces, huge) sits directly on/through the string field, no eyebrow above
it. One line of real positioning copy below. Primary CTA sits where the
string's resting node is — pressing it visibly plucks the string.

**FORM** — User-pinned (lenis.dev), not rolled. Mechanism translated as
"vibrating string," this brand's own instrument, not lenis.dev's literal
grain/marquee/logo-wall content.

**FINISH** — unreviewed and undocumented is unfinished; this build ends with
the finish review, the verdict, DESIGN.md, and every shipping raster
carrying its provenance.

## Build notes (code-led — no image generation available this session)

- Real `lenis` package driving scroll physics site-wide (this surface).
- Real WebGL (`three` + `@react-three/fiber`) for the string field — not a
  CSS/SVG imitation. Velocity-reactive amplitude, pointer-reactive bend.
  Disabled/replaced by a static image or CSS gradient under
  `prefers-reduced-motion` or when WebGL is unavailable.
- Remove every eyebrow label site-wide (`SectionHeading`'s eyebrow prop).
- Replace the Courses/Experience/Faculty icon-card grids and the 3-stat hero
  band with non-template compositions (concert-program list logic: varied
  scale and rhythm, not repeated identical cards).
- Keep: real content (branches, instruments, faculty domains), routes,
  `/login` links, accessibility posture already in `Reveal`/`TiltCard`.

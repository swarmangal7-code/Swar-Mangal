# Design

<!-- impeccable:design-schema 1 -->

## Scope

This file documents the **public landing page** (`src/app/page.tsx`) redesign
only. The founder/staff web dashboards elsewhere in this codebase are a
separate, Operate-mode system with their own established UI (shadcn/Radix +
Tailwind, functional not expressive) and are not covered here.

## World: Recital Bill

Replaces the page's first world (near-black ground, brass-gold string,
Playfair Display + Inter) after the founder reported it "doesn't look as
expected" across all three axes — color, layout, type — following an
earlier amplification pass. Redesign, not refinement: the old look stood as
evidence of what this subject is (a serious, festive, Indian-classical-
rooted Mumbai academy, per PRODUCT.md), not authority over what it becomes.

The governing idea: the page reads as a **printed concert recital
program/ticket**, not a SaaS landing page — the academy's own name,
"Mangal" (auspicious, festive), is the material the palette is built from,
not just a tagline.

- **Palette — Committed strategy** (one saturated hue carries real surface
  area, not a restrained neutral-plus-accent): `#1B2559` / `#141D47` (two
  deep indigo grounds, alternated per section — a concert hall's house
  lights, not a device chrome near-black), `#F2A13A` / `#F6B55A`
  (saffron-marigold — the "Mangal" color, used as a functional material:
  rule lines, the ticket seal, button fills, 30-60% of visible surface
  across the page, never a decorative gradient-fill on body text),
  `#F7F2E8` (primary text, warm ivory), `#C7C2DD` (secondary text, a
  cool lavender-grey pulled toward the indigo ground rather than a flat
  gray).
- **Type**: Fraunces (`--font-display`, headings — bold/black weights,
  italic for emphasis lines, a concert bill's display voice) paired with
  Space Grotesk (`--font-sans`, body/nav/labels — a geometric sans with
  its own character, replacing Inter). Both loaded in `src/app/page.tsx`
  itself via `next/font/google`, **not** the root `layout.tsx**: their
  generated CSS variables (`--font-recital-display`/`--font-recital-sans`)
  are bound to the shared `--font-display`/`--font-sans` names only inside
  this page's own wrapper `<div style={{ '--font-display': ... }}>`, so
  every descendant's existing `font-display`/`font-sans` Tailwind class
  picks up the new faces through ordinary CSS inheritance with zero
  per-component edits — and the founder/staff dashboards, which share
  those same variable *names* for their own unrelated Inter/Playfair
  setup, are completely unaffected since each route renders its own
  subtree under `<body>`.
- **Ticket/program motifs**: a perforated tear-line (`repeating-linear-
  gradient`, no image) replaces every plain hairline divider between
  sections; a dashed-circle "सा" seal (`TonicSeal`, tilted -3°, standing in
  for a hand-stamped admission mark) replaces the old concentric-rings CSS
  panel in About; course cards carry an internal dashed tear-line
  separating their billing (name + level) from their program note; four
  print-registration crosshairs pin the hero's viewport corners — the
  mark a press proof carries, doing the job a kicker label would do
  (signaling "this is a printed program") without the banned kicker
  itself.
- **Signature motif** (unchanged mechanism, recolored): a lit string/wire
  in real WebGL threading through the hero, echoed as the perforated
  tear-line between sections below it — still "sound made visible" as a
  literal object, now strung in saffron rather than brass-gold.
- **Night sky** (unchanged mechanism, recolored): the shader-lit star
  field (`star-field.tsx`) now tints warm cream/saffron stars over deep
  indigo rather than near-black — the same recital-hall-at-night reading,
  inside the new palette.

## Signature interaction

`src/components/3d/string-field.tsx` — a `@react-three/fiber` scene, three
strands built as raw `THREE.Line` objects (not the `<line>` JSX tag, which
collides with the DOM/SVG element under TypeScript's JSX namespace) with
per-frame `BufferAttribute` writes, additive blending for glow:

- **Idle**: slow ambient sway (low-frequency sine per strand).
- **Pointer**: a gaussian bend toward the cursor position (mapped from
  R3F's normalized pointer coords) — a literal "pluck."
- **Scroll**: `src/components/motion/lenis-provider.tsx` writes live Lenis
  velocity into `src/lib/motion/scroll-state.ts` (plain mutable refs, no
  React state, read inside `useFrame` every frame) — faster scrolling
  raises the string's vibration amplitude and frequency.

Real Lenis (`lenis` package) drives scroll physics for this page only, off
entirely under `prefers-reduced-motion`. `StringField` itself falls back to
a static 1px gradient line (now saffron) under reduced motion or when
WebGL is unavailable — same visual position, zero animated frames, so
there is never a blank gap, only a quieter version of the same object.

The hero's canvas wrapper spans the full hero section (`absolute inset-0`),
not a fixed-height band centered on the string, so the star field lights
the whole viewport rather than a horizontal strip. The star field's own
vertical spread runs both above and below the string's plane.

**Performance**: `three` + `@react-three/fiber` (+ `@react-three/postprocessing`
+ `postprocessing` for bloom) are lazy-loaded (`next/dynamic`, `ssr: false`)
so none of it blocks the landing page's initial JS. Bloom and the dust/note
particle field (`particle-field.tsx`) stay **desktop-only**
(`min-width: 768px`) — PRODUCT.md is explicit this audience skews toward
mid/low-end Android. The star field is the one exception, cheap enough
(shader points, no texture, no bloom dependency) to run on every device at
a lower count on narrow viewports, its horizontal spread derived from the
live camera FOV/aspect so it fills whatever frame it draws in. Homepage
First Load JS: ~171kB (was ~170kB before this redesign; Fraunces + Space
Grotesk are self-hosted font files via `next/font`, not JS bundle weight).

## Layout width

Section/CTA/footer shells use `max-w-[88rem]` (1408px), not Tailwind's
`max-w-6xl` (1152px) — on a standard 1920px monitor, 6xl left ~384px of
dead margin per side. The narrower prose caps inside sections
(`max-w-2xl`/`max-w-xl`/`max-w-md`, the craft-floor's 65-75ch body measure)
are unchanged — only the outer shell widened.

About's two-column grid moved from an even split to an asymmetric
`lg:grid-cols-12` (7 cols copy / 5 cols seal) — a poster's collage
asymmetry rather than a centered SaaS feature split.

## Composition rules (this surface)

- **No eyebrow/kicker labels.** Every heading carries its own weight; the
  print-registration corner marks do the "this is a printed program"
  signaling a kicker would, without a text label.
- **No repeated icon+heading+text card grids.** Courses reads as a torn
  admission-stub list (name + level + perforated tear-line + program
  note), not icon cards. Experience is an asymmetric offset two-column
  list. Faculty is a flowing wrapped credits reel, not avatar cards.
- **No hero-metric stat block.** The three factual numbers (10+
  instruments, 2 centres, 1-on-1) run as one italic program-note sentence.
- **Branches keeps its two-card layout** — exactly two real physical
  locations; location data, not a templated repeat.

## Open decisions / honest risk

- No real photography, faculty headshots, or logo file yet (see
  `PRODUCT.md` → Evidence on Hand). All visuals are abstract/drawn
  placeholders (the ticket seal, the string field) — nothing here fakes a
  specific claim.
- Display type at `6.75rem` in the hero exceeds this skill's `6rem`
  display ceiling guideline — kept for first-viewport impact in Persuade
  mode, same ceiling exception as the previous world.
- Focus-visible states and custom text-selection/scrollbar theming are
  still not themed for this surface (pre-existing gap, carried over, not
  introduced by this redesign).
- `src/components/motion/custom-cursor.tsx:58` animates `width`/`height`
  directly (flagged by `impeccable detect`) — pre-existing, not touched by
  this redesign beyond its border color; a follow-up pass should switch it
  to a `scale` transform.

## Provenance

No generated raster assets ship on this surface (WebGL is drawn, not
imaged; the ticket seal is CSS/DOM, not a raster). Nothing here required
`impeccable embed-prompt`.

**FINISH**: reviewed via direct screenshot inspection (desktop 1440px and
mobile 390px, section-by-section via scroll rather than a single full-page
capture — an initial full-page mobile capture caught several sections
before their scroll-reveal `Reveal` animations fired, which would have
read as missing content; recapturing section-by-section with a real scroll
event per section resolved it) rather than the shipped finish-reviewer/
documenter subagents — disclosed substitution, given no confirmed
image-generation tool in this session. `impeccable detect --json` ran
clean except the one pre-existing `custom-cursor.tsx` finding noted above.

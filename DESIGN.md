# Design

<!-- impeccable:design-schema 1 -->

## Scope

This file documents the public surfaces' **Midnight Raga** redesign:
`src/app/page.tsx` (the landing page) plus the three form surfaces that
share its new world — `src/app/(auth)/login/page.tsx`,
`src/app/enroll/[token]/page.tsx`, and `src/app/terms/[token]/page.tsx`.
These replace the previous light glass/ink world (grain-paper ground,
geometric grotesk pair, glass drop, documented in earlier revisions
of this file and no longer shipped). The founder/staff web dashboards
elsewhere in this codebase are a separate, Operate-mode system with their
own established UI (shadcn/Radix + Tailwind, functional not expressive) and
are not covered here — the two worlds share no tokens: the new palette and
fonts live under a `.sm-landing` CSS scope (see World, below) that only
wraps these four routes' own root element. The dashboards themselves kept
every layout and component but were retuned in the same pass to warm
concert surfaces with brass accents (via the `--dash-*` tokens only),
plus gold text selection, focus rings and glow shadows shared
across both worlds.

## World

Ivory morning ground - first light and heritage, not a recital hall or a SaaS
dashboard. Founder-pinned direction, chosen from five concepts as a blend
of 1 (dawn light, italics, brightening scroll) and 4 (Devanagari voice,
tanpura strings, parampara told only with real facts), translated into
the academy's own content, never pasted. Predecessors (Midnight Raga dark,
light glass/ink, cinematic string-field) are documented in older
revisions; the four portfolio references that fed this blend are HT's
mono telemetry, JJ's craft grain, Nihal's HUD chips and Vedh's cockpit
gauges.

- **Palette**: `#F5EFE2` (ivory morning ground, brightening per section
  toward cream bands), `#2A1512` (deep maroon ink, primary text),
  `#D6A84F` (warm brass/gold — the one
  accent carried over from the previous world: brass CTA fills,
  field-lines, telemetry separators, hairline rules
  and small highlights, never a decorative text-fill), `#6E2018` (deep
  maroon, primary buttons and headings emphasis) plus
  one distinct saturated colour per real instrument (see Courses, below).
  Scoped entirely under a `.sm-landing` class (`globals.css`) that
  repoints the shared shadcn tokens (`--background`, `--primary`,
  `--border`, etc. — the same tokens `Button`/`Input`/the `.text-*`
  utilities already read) to this palette   and forces `color-scheme: dark`
  regardless of the visitor's OS theme, so the founder/staff dashboards
  (which read the same token names outside this class) keep the retuned
  warm concert values from the same pass, documented in Scope, above.
- **Type**: Fraunces (`--font-display-alt`, optical serif, semibold
  headings with italic accents) paired with Manrope (`--font-sans-alt`,
  body) plus IBM Plex Mono (`--font-mono-alt`, telemetry readouts) and
  Tiro Devanagari Hindi (`--font-dev`, the sa motif, swar strip and
  accents, applied only inside `.sm-landing` via the `.sm-dev` class), — a bold
  an optical serif with a classical-editorial voice, chosen over both the
  previous world's geometric grotesk and the generic sans default. Loaded globally via `next/font/google`
  in `src/app/layout.tsx` but never applied as `--font-sans`/`--font-display`
  outside `.sm-landing` — the dashboards keep Inter/Playfair Display.
- **Grain**: a fixed, full-viewport `feTurbulence` SVG data-URI
  (`.sm-grain` in `globals.css`) laid   over the ember-black ground at low opacity
  with `mix-blend-mode: screen` — texture, not an image asset.
- **Signature object**: a rising sun of soft marigold light (`GlassOrb`,
  `src/components/landing/glass-orb.tsx`) — layered radial-gradients plus
  `backdrop-filter: blur() saturate()` so it visibly refracts the ground
  and field-lines behind it, finished with a small SVG
  `feTurbulence`/`feDisplacementMap` filter on its rim highlight for an
  organic waver. Pure CSS/SVG, no WebGL —   this world's translation of the
  previous direction's lit glass into lamplight, and cheap enough to
  run on every device tier without a desktop gate.
- **Field-lines** (`FieldLines`, `field-lines.tsx`): thin curved SVG paths
  in the brass accent with a soft glow, radiating from the sun, with an animated
  `stroke-dashoffset` flow gated to `prefers-reduced-motion: no-preference`
  — with it on, the same paths render static and complete, never a blank
  gap.
- **Instrument colour**: each of the six real instruments owns one
  saturated colour as a material, lifted for the dark ground, one per
  real instrument - guitar amber `#E8A83E`,
  piano & keys lifted indigo `#6E68D6`, vocal crimson `#D15460`, tabla
  terracotta `#D2803F`, violin teal `#3FA39A`, flute forest `#5C9457`, each
  paired with a text-ink colour chosen per-swatch for contrast on the dark
  ground, never a flat gray-on-hue. The shape is a hand-authored ragged
  SVG path, not a `clip-path` polygon or a plain rectangle - see
  Composition rules for how
  its raggedness is deliberately asymmetric (top/sides ragged, bottom
  edge shallow) so the instrument name always lands on the painted colour.

## Signature interaction

The draggable glass lens (`GlassLens`, `src/components/landing/glass-lens.tsx`)
— the literal "liquidGL" interaction from the stackht.pages.dev reference: a
circular lens the visitor drags across the hero to see it refract.

- A plain CSS `backdrop-filter: blur() saturate() brightness()` refracts
  whatever sits behind the lens.
- A separate `filter: url(#sm-lens-distort)` — referencing an SVG
  `feTurbulence`/`feDisplacementMap` filter the component defines inline —
  warps the lens's own rendered output for the liquid-glass waver. This is
  kept as a **separate** CSS property from `backdrop-filter`, not combined
  into one function list (`backdrop-filter: blur() url(#id)`): some engines
  silently drop the entire `backdrop-filter` value when an SVG filter
  reference is mixed with plain filter functions in the same list, which
  first shipped this lens with no visible blur AND no other paint to make
  it visible — a fully invisible hit-target. The lens also always carries
  an explicit radial-gradient `background` and a `border`, so it reads as a
  visible glass bubble even on an engine that drops both filters entirely;
  the blur/distort are pure enhancement on top of a shape that is never
  see-through-empty.
- `framer-motion`'s `drag` + `dragConstraints` (bound to the hero section's
  own ref) keeps it inside the ground it exists to distort. Direct
  pointer-driven dragging isn't the kind of autoplay motion
  `prefers-reduced-motion` targets, so the lens stays draggable either way;
  what's disabled under that preference is only the elastic spring-back
  feel (`dragElastic`/`dragTransition`), so a reduced-motion visitor gets a
  lens that moves exactly where they put it, no bounce.
- Rests beside the glass orb by default (`right-[12%] top-[46%]` of the
  hero), not over either CTA pill — an earlier position
  (`left-[14%] top-[62%]`) sat directly on top of the "Enroll now"/"Browse
  courses" buttons.

Pure CSS/SVG, no WebGL and no new dependency — cheap enough to run on every
device tier without a desktop gate, per PRODUCT.md's mid/low-end-Android
constraint.

**Performance**: no new heavy dependency shipped for this redesign (no
Three.js/WebGL work added — the orb, field-lines and lens are all CSS/SVG).
Homepage First Load JS: ~167kB.

## Layout width

Section/CTA/footer shells use `max-w-[88rem]` (1408px), not Tailwind's
`max-w-6xl` (1152px) the incumbent page shipped with — on a standard
1920px-wide monitor, 6xl left ~384px of dead margin on each side, which
read as unfinished rather than deliberately editorial. 88rem keeps the
same centered, breathing-room composition at normal desktop widths while
using noticeably more of a wide monitor. The narrower prose caps inside
sections (`max-w-2xl`/`max-w-xl`/`max-w-md` on individual paragraphs, the
craft-floor's 65-75ch body measure) are unchanged — only the outer shell
widened, not the text column itself.

## Composition rules (this surface)

Derived directly from a redesign against this skill's craft-floor bans,
which the incumbent page violated throughout:

- **No eyebrow/kicker labels.** Every heading carries its own weight; no
  uppercase-tracked label above any `<h2>` or `<h1>`. This includes the
  enroll/terms form cards: an earlier draft placed a small-caps "Swar
  Mangal" line directly above each page's `<h1>` — a textbook kicker,
  removed in favour of folding the brand mark into the icon badge above it
  as an icon+wordmark lockup (the same identity pairing as the landing
  page's nav pill), which is a logo lockup, not a label announcing the
  heading below it.
- **No repeated icon+heading+text card grids.** Courses is six ragged
  paint-stroke colour swatches, one per real instrument (see World) — a
  distinct, single-purpose motif translated from jjtheartist's skill-bars,
  not a card grid. Experience is an asymmetric offset two-column list (odd
  items pushed down on desktop). Faculty is a flowing wrapped list (a
  credits reel), not avatar cards.
- **No hero-metric stat block.** The real facts (two branches, one-to-one,
  six instruments) run as one sentence under the headline, not a `dd`/`dt`
  grid.
- **Branches keeps its two-card layout** — justified because there are
  exactly two real physical locations; this is location data, not a
  templated repeat of arbitrary content.

## Open decisions / honest risk

- No real photography, faculty headshots, or logo file yet (see
  `PRODUCT.md` → Evidence on Hand). All visuals are abstract/geometric
  placeholders (the glass orb, the paint-stroke swatches) — swap for real
  assets when available; nothing here fakes a specific claim.
- The hero headline's copy ("Sound, taught / one-to-one.") was rewritten
  during this pass specifically to hold two lines at both desktop (1440px)
  and mobile widths — an earlier draft ("Sound you can / see, taught
  right.") read fine at the comp width but re-wrapped into four or five
  lines at narrower columns once Syne's actual letterforms were measured.
  Revisit the exact wording if the founder wants different emphasis, but
  keep new copy short enough (each clause under ~14 characters) to hold the
  two-line promise without re-testing every breakpoint by eye.
- Focus-visible rings and text selection are now brass-gold across both
  worlds (added in the Midnight Raga pass, closing the earlier gap).
- `@cloudflare/next-on-pages` (the `pages:build` script, the actual
  Cloudflare static-export target) could not be run to completion on the
  Windows machine this redesign was built on — its own CLI prints a
  warning that it "seems not to work reliably on Windows" and fails inside
  its `shellac` subprocess spawner before touching the Next build output.
  `next build` (the underlying production build) succeeds cleanly. This is
  a known tooling limitation, not something introduced by this redesign;
  confirm `pages:build` on a Linux/WSL/CI runner before relying on it.

## Provenance

No generated raster assets ship on these surfaces (the grain ground is an
inline SVG `feTurbulence` data URI, the glass orb and paint-stroke swatches
are CSS/SVG, not rasters). Nothing here required `impeccable embed-prompt`.

**FINISH**: reviewed via direct screenshot inspection (desktop 1440px and
mobile 390px, all four routes — landing page, login, enroll, terms) using a
real running dev server rather than the shipped finish-reviewer/documenter
subagents, given this Windows environment's constraints. An independent
finish review against this file's direction contract returned a "fix"
disposition with five material findings, all resolved in this pass: the
paint-stroke label text spilling outside the painted shape on five of six
cards (fixed by reshaping the ragged path so its bottom edge — where the
label sits — stays shallow and near-full-width while the raggedness lives
at the top/sides instead); the draggable glass lens rendering fully
invisible (fixed by separating the SVG distortion filter from
`backdrop-filter`'s function list and giving the lens an explicit visible
background, per Signature interaction, above); the enroll/terms kicker
labels (removed, folded into an icon+wordmark lockup, per Composition
rules, above); the hero headline wrapping to four/five lines instead of two
(fixed via shorter copy, per Open decisions, above); and this file itself,
which still documented the previous near-black cinematic/string-field world
this redesign replaced (rewritten throughout World and Signature
interaction, above).

**FINISH (Dawn Parampara pass)**: composes the same reviewed structure
plus one Parampara section (swar strip in the Devanagari voice; the
teaching lineage stated only with real facts, never invented gurus or
dates) and alternating crescendo bands. Verified by `tsc --noEmit` and
a clean production `next build` (no screenshot review was available in
this environment — confirm desktop 1440px and mobile 390px on device
before relying on it). Copy and
composition stay unchanged from the reviewed
pass (same sections, same two-line headline discipline, same no-kicker /
no-card-grid / no-stat-block rules, plus one looped instrument marquee
and one swar strip); the change is purely visual: ivory morning ground
with crescendo bands, Fraunces/Manrope/Plex Mono/Tiro type quartet,
rising-sun orb with tanpura strings, ivory-glass form
cards, and a warm concert retune of the dashboard `--dash-*` tokens with
no layout changes. Known carry-overs: no real photography or logo yet
(abstract placeholders only, nothing fabricated); `@cloudflare/next-on-pages`
still needs a Linux/WSL/CI runner for the static-export target.

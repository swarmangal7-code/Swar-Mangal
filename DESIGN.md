# Design

<!-- impeccable:design-schema 1 -->

## Scope

This file documents the **public landing page** (`src/app/page.tsx`) redesign
only. The founder/staff web dashboards elsewhere in this codebase are a
separate, Operate-mode system with their own established UI (shadcn/Radix +
Tailwind, functional not expressive) and are not covered here.

## World

Near-black, stage-lit ground — a recital hall at night, not a SaaS dashboard.

- **Palette**: `#08070B` / `#0E0C12` (two near-black grounds, alternated per
  section for quiet rhythm), `#F7F2E8` (primary text), `#A9A2B0` (secondary
  text), `#D6A84F` / `#E2BD68` (warm brass/string-metal gold — the one
  accent, used as a functional material: the string itself, hairline rules,
  small caps labels — never as a decorative gradient-fill on text).
- **Type**: Playfair Display (`--font-display`, headings, large scale, up to
  `clamp(3.25rem,10vw,6.75rem)` in the hero) paired with Inter (`--font-sans`,
  body). Both already the site's global font pair — not changed for this
  surface, since it already sits in this skill's recommended-face list.
- **Signature motif**: a lit string/wire, rendered in real WebGL (not CSS or
  SVG), threading through the hero and echoed as a thin static gradient line
  between every section below it — "sound made visible" as a literal,
  physical object rather than an illustration of the idea.
- **Cinematic layer** (added after a second pinned reference, lusion.co):
  bloom/glow post-processing, a drifting field of warm light motes and
  literal music-note glyphs, a cursor-following spotlight, a scroll-tied
  camera dolly, and a whole-page film-grain + vignette overlay. The hero
  opens inside this light; the CTA closes the page inside the same light
  (particles alone, no string) — a deliberate bookend, not a repeated
  effect.

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
a static 1px gradient line under reduced motion or when WebGL is
unavailable — same visual position, zero animated frames, so there is never
a blank gap, only a quieter version of the same object.

**Performance**: `three` + `@react-three/fiber` (+ `@react-three/postprocessing`
+ `postprocessing` for bloom) are lazy-loaded (`next/dynamic`, `ssr: false`,
via `src/components/3d/string-field-lazy.tsx` and `particle-accent-lazy.tsx`
— the App Router refuses `ssr:false` directly inside a Server Component) so
none of it blocks the landing page's initial JS. `three` is imported by
named export, not `import * as THREE`, so unused parts tree-shake. Homepage
First Load JS: ~163kB (was 403kB before lazy-loading; adding bloom and the
particle field did not move this number — they live in the same lazy chunk).

Bloom and the particle field (`src/components/3d/particle-field.tsx`) are
**desktop-only** (`min-width: 768px`), gated in both `string-field.tsx` and
`particle-accent.tsx` — PRODUCT.md is explicit that this audience skews
toward mid/low-end Android, and running an EffectComposer pass plus ~150
points on top of the string roughly doubles frame cost. The string itself
(the actual signature interaction) still plays at every size; only the
cinematic dressing scales back.

## Composition rules (this surface)

Derived directly from a redesign against this skill's craft-floor bans,
which the incumbent page violated throughout:

- **No eyebrow/kicker labels.** Every heading carries its own weight; no
  uppercase-tracked label above any `<h2>`.
- **No repeated icon+heading+text card grids.** Courses reads as a
  conservatory-program list (name + level + description per row, hairline
  dividers, no icon). Experience is an asymmetric offset two-column list
  (odd items pushed down on desktop). Faculty is a flowing wrapped list
  (a credits reel), not avatar cards.
- **No hero-metric stat block.** The three factual numbers (10+ instruments,
  2 centres, 1-on-1) run as one sentence, not a `dd`/`dt` grid.
- **Branches keeps its two-card layout** — justified because there are
  exactly two real physical locations; this is location data, not a
  templated repeat of arbitrary content.

## Open decisions / honest risk

- No real photography, faculty headshots, or logo file yet (see
  `PRODUCT.md` → Evidence on Hand). All visuals are abstract/geometric
  placeholders (the "सा" panel, the string field itself) — swap for real
  assets when available; nothing here fakes a specific claim.
- Display type at `6.75rem` in the hero exceeds this skill's `6rem` display
  ceiling guideline. Kept deliberately for first-viewport impact in Persuade
  mode (this was already the incumbent hero's scale); revisit only if a
  future pass finds it hurts small-viewport legibility in practice.
- Focus-visible states and custom text-selection/scrollbar theming were not
  added in this pass (pre-existing gap, not introduced here) — a follow-up
  accessibility/polish pass should close it.

## Provenance

No generated raster assets ship on this surface (WebGL is drawn, not
imaged; the "सा" panel is CSS/DOM, not a raster). Nothing here required
`impeccable embed-prompt`.

**FINISH**: reviewed via direct screenshot inspection (desktop 1440px and
mobile 390px, both `prefers-reduced-motion: reduce` for a static content
audit and live for interaction/motion verification) rather than the shipped
finish-reviewer/documenter subagents — disclosed substitution, given no
confirmed image-generation tool in this session and the CLI's `--start`
question-server path being unverified on this Windows environment. A real
hydration bug in the shared `Reveal` component (SSR/CSR mismatch on
`prefers-reduced-motion`, pre-existing, not introduced by this redesign) was
found via this process and fixed in `src/components/motion/reveal.tsx`.

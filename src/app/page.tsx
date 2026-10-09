import Link from "next/link";
import type { ReactNode } from "react";
import { Fraunces, Space_Grotesk } from "next/font/google";
import { ArrowRight, MapPin } from "lucide-react";

import { LenisProvider } from "@/components/motion/lenis-provider";
import { StringFieldLazy as StringField } from "@/components/3d/string-field-lazy";
import { ParticleAccentLazy as ParticleAccent } from "@/components/3d/particle-accent-lazy";
import { MagneticButton, TiltCard } from "@/components/3d/tilt-card";
import { Reveal } from "@/components/motion/reveal";
import { TextReveal } from "@/components/motion/text-reveal";
import { HeroTitle } from "@/components/motion/hero-title";
import { SectionTransition } from "@/components/motion/section-transition";
import { HorizontalScroller } from "@/components/motion/horizontal-scroller";
import { CinematicOverlay } from "@/components/motion/cinematic-overlay";
import { SiteNav } from "@/components/motion/site-nav";
import { CursorSpotlight } from "@/components/motion/cursor-spotlight";
import { CustomCursor } from "@/components/motion/custom-cursor";
import { LoadingScreen } from "@/components/motion/loading-screen";
import { cn } from "@/lib/utils/cn";

// This surface's own type family — Fraunces (a concert bill's display
// weight) and Space Grotesk (its program notes) — loaded here, not in the
// root layout, and bound to --font-display/--font-sans only inside this
// page's own wrapper below. The founder/staff dashboards share those same
// CSS variable names for their own (unrelated) Inter/Playfair setup; since
// each route renders its own subtree under <body>, scoping the override to
// this page's wrapper changes nothing outside it. See DESIGN.md ("Recital
// Bill") for why this pair replaces Playfair Display + Inter on this
// surface specifically.
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-recital-display",
  weight: ["500", "600", "700", "900"],
  style: ["normal", "italic"],
});
const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-recital-sans",
  weight: ["400", "500", "700"],
});

const courses = [
  {
    name: "Guitar",
    level: "Beginner to Advanced",
    desc: "From open chords and fingerstyle to lead lines, bollywood arrangement and contemporary performance.",
  },
  {
    name: "Piano & Keys",
    level: "Beginner to Advanced",
    desc: "Keyboard harmony, sight-reading and repertoire across classical, light and western music.",
  },
  {
    name: "Vocal",
    level: "All Levels",
    desc: "Hindustani classical rigour blended with semi-classical and light music training for every voice.",
  },
  {
    name: "Tabla",
    level: "All Levels",
    desc: "Bol mastery, layakari and timekeeping — from the first theka to confident accompaniment.",
  },
  {
    name: "Violin",
    level: "Intermediate +",
    desc: "Western technique, intonation and expressive bowing for classical and film repertoire.",
  },
  {
    name: "Flute",
    level: "All Levels",
    desc: "Breath control, ornamentation and melodic phrasing on bamboo and silver flutes.",
  },
];

const experience = [
  {
    title: "Personalized Instruction",
    desc: "Every student is taught one-to-one, with a syllabus matched to their pace, age and musical goals.",
  },
  {
    title: "Performance Opportunities",
    desc: "Seasonal recitals and open-mic evenings that turn daily practice into stage confidence.",
  },
  {
    title: "Theory + Practice",
    desc: "Notation, ragas, scales and rhythm cycles sit beside technique — students understand the music they play.",
  },
  {
    title: "Recording Studio",
    desc: "An in-house studio for capturing lessons, demo tracks and exam practice — play it back and hear the progress.",
  },
];

const faculty = [
  { name: "Guitar faculty", domain: "Classical · Western · Fingerstyle" },
  { name: "Vocal faculty", domain: "Hindustani · Semi-Classical · Light" },
  { name: "Tabla & Rhythm faculty", domain: "Layakari · Accompaniment · Ensemble" },
  { name: "Piano & Keys faculty", domain: "Harmony · Sight-Reading · Repertoire" },
];

const branches = [
  {
    tag: "Founding Studio",
    name: "Kandivali Centre",
    address: "Kandivali West, Mumbai",
    note: "The founding studio of Swar Mangal — home to vocal and guitar batches, individual practice rooms and the in-house recording setup.",
  },
  {
    tag: "Second Centre",
    name: "Goregaon Centre",
    address: "Goregaon West, Mumbai",
    note: "Spacious group rooms for keyboard, tabla and violin, plus weekly ensemble sessions and open rehearsal evenings.",
  },
];

function PrimaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <MagneticButton>
      <Link
        href={href}
        className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#F2A13A] px-7 py-3.5 text-sm font-semibold text-[#1B2559] transition-colors hover:bg-[#F6B55A]"
      >
        <span>{children}</span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </MagneticButton>
  );
}

function GhostButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#F7F2E8]/25 px-7 py-3.5 text-sm font-semibold text-[#F7F2E8] transition-colors hover:border-[#F6B55A]/60 hover:text-[#F6B55A]"
    >
      {children}
    </Link>
  );
}

/** The recurring motif between sections — a ticket's perforated tear-line,
 *  not a plain hairline: this page reads as a printed recital program, and
 *  a program's sections are separated the way its pages tear apart. */
function StringDivider() {
  return (
    <div
      aria-hidden
      className="h-px w-full opacity-70"
      style={{
        backgroundImage: "repeating-linear-gradient(to right, #F2A13A 0, #F2A13A 6px, transparent 6px, transparent 16px)",
      }}
    />
  );
}

/** Four print-registration crosshairs pinned to the viewport corners — the
 *  marks a press proof carries, here standing in for a kicker label this
 *  surface refuses: decoration that signals "printed program," not a
 *  caption competing with the headline. */
function RegistrationMarks() {
  const mark = (position: string) => (
    <div aria-hidden className={cn("pointer-events-none absolute h-5 w-5 opacity-40", position)}>
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#F2A13A]" />
      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[#F2A13A]" />
    </div>
  );
  return (
    <>
      {mark("left-5 top-5 md:left-8 md:top-8")}
      {mark("right-5 top-5 md:right-8 md:top-8")}
      {mark("bottom-5 left-5 md:bottom-8 md:left-8")}
      {mark("bottom-5 right-5 md:bottom-8 md:right-8")}
    </>
  );
}

function Section({ id, tint, children }: { id: string; tint: string; children: ReactNode }) {
  return (
    <section id={id} className="relative">
      <StringDivider />
      <SectionTransition className={cn("mx-auto w-full max-w-[88rem] px-6 py-20 md:py-28", tint)}>
        {children}
      </SectionTransition>
    </section>
  );
}

function SectionHeading({ title, blurb }: { title: string; blurb?: string }) {
  return (
    <Reveal>
      <div className="mb-14 max-w-2xl md:mb-20">
        <h2 className="font-display text-3xl italic leading-tight text-[#F7F2E8] md:text-4xl">{title}</h2>
        {blurb && <p className="mt-4 text-[15px] leading-relaxed text-[#C7C2DD]">{blurb}</p>}
      </div>
    </Reveal>
  );
}

function Hero() {
  return (
    <section id="top" className="relative flex min-h-screen flex-col overflow-hidden bg-[#1B2559]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-[6%] top-[20%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle_at_center,hsla(32,88%,58%,0.14),transparent_62%)] blur-2xl" />
        <div className="absolute right-[4%] top-[32%] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle_at_center,hsla(260,45%,40%,0.22),transparent_62%)] blur-2xl" />
      </div>

      <RegistrationMarks />

      {/* The signature interaction — a real, lit string spanning the hero,
          bending toward the cursor and gaining amplitude with scroll velocity.
          This wrapper deliberately keeps pointer events ON (no
          pointer-events-none) so the canvas can actually track the cursor;
          the hero copy layered on top opts back OUT of hit-testing itself
          (see below) wherever it isn't literally a link, so the string stays
          interactive through all the "empty" space around the text.
          `loading`'s placeholder has no className of its own, so this
          wrapper carries the position/size both it and the real canvas fill.
          Spans the full hero (inset-0), not a fixed-height centered band —
          the star field behind the string needs the whole viewport to read
          as a night sky rather than a lit strip with plain black above and
          below it. The string itself stays visually centered regardless,
          since its world position sits near y=0 and the camera always
          looks at the origin. */}
      <div className="absolute inset-0 z-0">
        <StringField className="h-full w-full" />
      </div>

      <CursorSpotlight />

      {/* pointer-events-none on the whole block: this is what lets the
          string field track the cursor through every bit of "empty" space
          around the type, exactly like plucking past the words rather than
          the words blocking the string. Only the two links opt back in. */}
      <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 pb-32 pt-16 text-center">
        <HeroTitle />
        <TextReveal
          startDelay={0.5}
          stagger={0.14}
          lines={[
            <div
              key="rule"
              aria-hidden
              className="my-8 flex items-center justify-center gap-4 text-[#F2A13A]"
            >
              <span
                className="h-px w-12 opacity-70 sm:w-20"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(to right, #F2A13A 0, #F2A13A 4px, transparent 4px, transparent 10px)",
                }}
              />
              <span className="font-display text-xl">सा</span>
              <span
                className="h-px w-12 opacity-70 sm:w-20"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(to right, #F2A13A 0, #F2A13A 4px, transparent 4px, transparent 10px)",
                }}
              />
            </div>,
            <p key="tagline" className="max-w-xl text-lg leading-relaxed text-[#C7C2DD] md:text-xl">
              Where every note finds its expression — Indian classical and Western
              instruments, taught one-to-one across two Mumbai studios.
            </p>,
            <div key="cta" className="pointer-events-auto mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <PrimaryButton href="#about">Explore the Academy</PrimaryButton>
              <GhostButton href="/login">Student / Staff Login</GhostButton>
            </div>,
          ]}
        />
      </div>
    </section>
  );
}

/** The "सा" mark, stamped like a ticket's admission seal — a dashed outer
 *  ring standing in for a perforated punch, tilted a few degrees off true
 *  the way a hand-stamped ticket never lands perfectly straight. */
function TonicSeal() {
  return (
    <div className="relative flex aspect-square w-full max-w-sm -rotate-3 items-center justify-center">
      <div className="absolute inset-0 rounded-full border-[3px] border-dashed border-[#F2A13A]/50" />
      <div className="absolute inset-[14px] rounded-full border border-[#F2A13A]/30" />
      <div className="absolute inset-[14px] rounded-full bg-[radial-gradient(circle_at_50%_38%,rgba(242,161,58,0.16),transparent_70%)]" />
      <div className="flex flex-col items-center">
        <span className="font-display text-[5rem] leading-none text-[#F6B55A] md:text-[6rem]">सा</span>
        <span className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-[#F7F2E8]/70">
          The Tonic
        </span>
      </div>
    </div>
  );
}

function About() {
  return (
    <Section id="about" tint="bg-[#1B2559]">
      <div className="grid items-center gap-16 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Reveal>
            <h2 className="font-display text-3xl italic leading-tight text-[#F7F2E8] md:text-4xl">
              Where music becomes discipline
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-[#C7C2DD]">
              Swar Mangal is a Mumbai music academy built around one idea — serious music education
              belongs to everyone. Students learn classical technique alongside modern repertoire,
              under teachers who still perform.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-[#C7C2DD]">
              From a child&apos;s first chord to a professional&apos;s final polish, every lesson is
              individual, intentional and accountable. A student joins for a subject; they stay for
              the discipline it teaches them.
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-10 border-t border-[#F2A13A]/20 pt-8 font-display text-xl italic leading-relaxed text-[#F6B55A] md:text-2xl">
              Ten-plus instruments. Two centres in Mumbai. Every lesson, one-to-one.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="lg:col-span-5">
          <TonicSeal />
        </Reveal>
      </div>
    </Section>
  );
}

/** A conservatory prospectus listing, not a grid of icon cards — one row per
 *  instrument, name and description sharing a line the way a concert
 *  program does; on desktop, vertical scroll drives the row sideways
 *  (see HorizontalScroller) — mobile keeps a native swipe list. Each card
 *  reads as a torn admission stub: a dashed tear-line separates the
 *  instrument's billing (name + level) from its program note. */
function Courses() {
  return (
    <Section id="courses" tint="bg-[#141D47]">
      <SectionHeading
        title="Learn the instrument, not the shortcut"
        blurb="Six disciplines, each taught as a living tradition — technique, theory and repertoire from day one."
      />
      <HorizontalScroller rowClassName="flex gap-5 px-1 lg:px-0">
        {courses.map((c, i) => (
          <Reveal key={c.name} delay={(i % 3) * 0.06} className="shrink-0 snap-start">
            <TiltCard maxTilt={4} cinematic>
              <article className="flex h-full w-[19rem] flex-col justify-between rounded-2xl border border-[#F7F2E8]/10 bg-[#212C63]/70 p-7 transition-colors duration-300 hover:border-[#F2A13A]/40 sm:w-[22rem]">
                <div>
                  <h3 className="font-display text-4xl italic leading-tight text-[#F7F2E8]">{c.name}</h3>
                  <span className="mt-2 inline-block text-[10px] font-bold uppercase tracking-[0.18em] text-[#F2A13A]/80">
                    {c.level}
                  </span>
                </div>
                <div
                  aria-hidden
                  className="my-6 h-px w-full opacity-60"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(to right, #F2A13A 0, #F2A13A 4px, transparent 4px, transparent 9px)",
                  }}
                />
                <p className="text-[15px] leading-relaxed text-[#C7C2DD]">{c.desc}</p>
              </article>
            </TiltCard>
          </Reveal>
        ))}
      </HorizontalScroller>
    </Section>
  );
}

function Experience() {
  return (
    <Section id="experience" tint="bg-[#1B2559]">
      <SectionHeading title="Lessons you feel, progress you hear" />
      <ul className="grid gap-x-10 gap-y-10 md:grid-cols-2">
        {experience.map((f, i) => (
          <li key={f.title} className={cn(i % 2 === 1 && "md:mt-14")}>
            <Reveal delay={i * 0.06}>
              <h3 className="font-display text-2xl italic text-[#F7F2E8]">{f.title}</h3>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[#C7C2DD]">{f.desc}</p>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** A credits reel, not a grid of avatar cards — faculty read like a program
 *  insert, wrapped and flowing rather than boxed. */
function Faculty() {
  return (
    <Section id="faculty" tint="bg-[#141D47]">
      <SectionHeading
        title="Taught by musicians, not just teachers"
        blurb="Every faculty member is a working musician first — a performer who brings stage experience, patience and honest ears into the room."
      />
      <Reveal>
        <ul className="flex flex-wrap gap-x-12 gap-y-8">
          {faculty.map((f) => (
            <li key={f.name} className="min-w-[14rem] flex-1">
              <h3 className="font-display text-xl italic text-[#F7F2E8]">{f.name}</h3>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-[#C7C2DD]">
                {f.domain}
              </p>
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}

function Branches() {
  return (
    <Section id="branches" tint="bg-[#1B2559]">
      <SectionHeading
        title="Two centres, one sound"
        blurb="Both branches share the same syllabus, faculty and studio standard — so a student can move between them without missing a beat."
      />
      <div className="grid gap-5 md:grid-cols-2">
        {branches.map((b, i) => (
          <Reveal key={b.name} delay={i * 0.1}>
            <TiltCard maxTilt={3} lift={6} cinematic>
              <article className="group flex h-full flex-col rounded-2xl border border-[#F7F2E8]/10 bg-[#212C63]/70 p-7 transition-colors duration-300 hover:border-[#F2A13A]/40">
                <span className="mb-5 inline-flex w-fit rounded-full border border-[#F2A13A]/30 bg-[#F2A13A]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#F6B55A]">
                  {b.tag}
                </span>
                <div className="flex items-start gap-3">
                  <MapPin
                    className="mt-1.5 h-5 w-5 shrink-0 text-[#F2A13A] transition-colors duration-300 group-hover:text-[#F6B55A]"
                    aria-hidden
                  />
                  <div>
                    <h3 className="font-display text-2xl italic text-[#F7F2E8]">{b.name}</h3>
                    <p className="mt-1 text-sm text-[#F6B55A]/80">{b.address}</p>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-relaxed text-[#C7C2DD]">{b.note}</p>
              </article>
            </TiltCard>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function Cta() {
  return (
    <section className="relative bg-[#141D47]">
      <StringDivider />
      <div className="mx-auto w-full max-w-[88rem] px-6 py-20 md:py-28">
        <div className="relative overflow-hidden rounded-3xl border border-[#F2A13A]/25 bg-[radial-gradient(120%_150%_at_50%_-20%,hsla(32,88%,58%,0.16),transparent_55%)] px-6 py-16 text-center md:px-16 md:py-24">
          {/* The page's closing 3D moment — see particle-accent.tsx. Desktop
              only and behind everything (z-0, pointer-events-none via its
              own canvas wrapper never receiving events), so it never
              competes with the buttons below for clicks. */}
          <ParticleAccent className="pointer-events-none absolute inset-0 z-0" />
          {/* position:absolute descendants paint above static in-flow
              content regardless of z-index, so the particle layer above
              would otherwise sit over this text — relative+z-10 opts this
              whole block back into the stacking order above it. */}
          <div className="relative z-10">
            <Reveal>
              <h2 className="font-display text-4xl italic leading-tight text-[#F7F2E8] md:text-5xl">
                Begin Your Musical Journey
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-[#C7C2DD]">
                Slots are limited per batch. Log in as a student or staff member to view schedules,
                invoices and progress — all in one place.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <PrimaryButton href="/login">Student / Staff Login</PrimaryButton>
                <GhostButton href="#courses">Browse Courses</GhostButton>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#F7F2E8]/10 bg-[#1B2559]">
      <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#F2A13A]/50 font-display text-sm text-[#F6B55A]">
            S
          </span>
          <span className="text-sm text-[#C7C2DD]">© 2026 Swar Mangal Music Academy</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#C7C2DD]">
          <a href="#courses" className="transition-colors hover:text-[#F6B55A]">
            Courses
          </a>
          <a href="#faculty" className="transition-colors hover:text-[#F6B55A]">
            Faculty
          </a>
          <a href="#branches" className="transition-colors hover:text-[#F6B55A]">
            Find Us
          </a>
          <Link href="/login" className="transition-colors hover:text-[#F6B55A]">
            Student / Staff Login
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div
      className={cn(display.variable, sans.variable)}
      style={{
        // Shadow the global --font-display/--font-sans only within this
        // page's own subtree (see the font-loading comment above) — every
        // descendant component's existing font-display/font-sans Tailwind
        // classes pick these up automatically via CSS inheritance, with
        // zero changes needed in site-nav.tsx, hero-title.tsx, etc.
        ["--font-display" as string]: "var(--font-recital-display)",
        ["--font-sans" as string]: "var(--font-recital-sans)",
      }}
    >
      <LenisProvider>
        <SiteNav />
        <main className="bg-[#1B2559] font-sans text-[#F7F2E8]">
          <Hero />
          <About />
          <Courses />
          <Experience />
          <Faculty />
          <Branches />
          <Cta />
          <Footer />
        </main>
        <CinematicOverlay />
        <CustomCursor />
        <LoadingScreen />
      </LenisProvider>
    </div>
  );
}

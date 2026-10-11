import type { ReactNode } from "react";

import { LenisProvider } from "@/components/motion/lenis-provider";
import { Reveal } from "@/components/motion/reveal";
import { HeroStage } from "@/components/landing/hero-stage";
import { PaintStroke } from "@/components/landing/paint-stroke";
import { Section, SectionHeading, InkDivider } from "@/components/landing/section";
import { cn } from "@/lib/utils/cn";

const instruments = [
  {
    name: "Guitar",
    label: "Beginner to advanced",
    color: "#E6A23C",
    ink: "#1F1205",
  },
  {
    name: "Piano & Keys",
    label: "Beginner to advanced",
    color: "#4D4A9E",
    ink: "#F6F4EF",
  },
  {
    name: "Vocal",
    label: "Hindustani · Semi-classical",
    color: "#B23A48",
    ink: "#FCEEE9",
  },
  {
    name: "Tabla",
    label: "Layakari · Accompaniment",
    color: "#C1693B",
    ink: "#FBEEE3",
  },
  {
    name: "Violin",
    label: "Intermediate and up",
    color: "#2F7A74",
    ink: "#EAFBF8",
  },
  {
    name: "Flute",
    label: "Bamboo · Silver",
    color: "#3C6B3A",
    ink: "#EFF9EC",
  },
] as const;

const experience = [
  {
    title: "One-to-one, always",
    desc: "Every student gets a syllabus matched to their own pace, age and goals — never a shared group slot.",
  },
  {
    title: "Performance opportunities",
    desc: "Seasonal recitals and open-mic evenings turn daily practice into real stage confidence.",
  },
  {
    title: "Theory with the practice",
    desc: "Notation, ragas, scales and rhythm cycles sit beside technique, so students understand what they play.",
  },
  {
    title: "In-house recording",
    desc: "A recording setup for lessons, demo tracks and exam practice — play it back and hear the progress.",
  },
];

const faculty = [
  { name: "Guitar faculty", domain: "Classical · Western · Fingerstyle" },
  { name: "Vocal faculty", domain: "Hindustani · Semi-classical · Light" },
  { name: "Tabla & rhythm faculty", domain: "Layakari · Accompaniment · Ensemble" },
  { name: "Piano & keys faculty", domain: "Harmony · Sight-reading · Repertoire" },
];

const branches = [
  {
    tag: "Founding studio",
    name: "Kandivali Centre",
    address: "Kandivali West, Mumbai",
    note: "The founding studio of Swar Mangal — individual practice rooms and the in-house recording setup.",
  },
  {
    tag: "Second centre",
    name: "Goregaon Centre",
    address: "Goregaon West, Mumbai",
    note: "Spacious rooms for keyboard, tabla and violin, plus weekly ensemble sessions and open rehearsal evenings.",
  },
];

function About() {
  return (
    <Section id="about">
      <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-[#15141A] md:text-4xl">
            Where music becomes discipline
          </h2>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[#15141A]/65">
            Swar Mangal is a real, operating music academy across two Mumbai studios. Students learn
            classical technique alongside contemporary repertoire, under teachers who still perform.
          </p>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#15141A]/65">
            From a first chord to a professional&apos;s final polish, every lesson is individual,
            intentional and accountable — one teacher, one student, one instrument at a time.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="border-t border-[#15141A]/10 pt-8 font-display text-xl font-bold leading-relaxed text-[#15141A] md:text-2xl">
            Two centres in Mumbai. Six instruments taught. Every lesson, one-to-one.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}

/** Paint-stroke bars, one ragged saturated shape per real instrument — the
 *  jjtheartist skill-bar motif translated into the academy's own content,
 *  never arbitrary and never a repeated icon+heading+text card. */
function Courses() {
  return (
    <Section id="courses">
      <SectionHeading
        title="Six instruments, taught as living traditions"
        blurb="Technique, theory and repertoire from day one — never a shortcut version of the real thing."
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {instruments.map((ins, i) => (
          <Reveal key={ins.name} delay={(i % 3) * 0.06}>
            <PaintStroke color={ins.color} ink={ins.ink} name={ins.name} label={ins.label} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function Experience() {
  return (
    <Section id="experience">
      <SectionHeading title="Lessons you feel, progress you hear" />
      <ul className="grid gap-x-10 gap-y-10 md:grid-cols-2">
        {experience.map((f, i) => (
          <li key={f.title} className={cn(i % 2 === 1 && "md:mt-14")}>
            <Reveal delay={i * 0.06}>
              <h3 className="font-display text-2xl font-bold text-[#15141A]">{f.title}</h3>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[#15141A]/65">{f.desc}</p>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** A flowing, wrapped credits list — not avatar cards. */
function Faculty() {
  return (
    <Section id="faculty">
      <SectionHeading
        title="Taught by musicians, not just teachers"
        blurb="Every faculty member performs first and teaches second — stage experience, patience and honest ears in the room."
      />
      <Reveal>
        <ul className="flex flex-wrap gap-x-12 gap-y-8">
          {faculty.map((f) => (
            <li key={f.name} className="min-w-[14rem] flex-1">
              <h3 className="font-display text-xl font-bold text-[#15141A]">{f.name}</h3>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#15141A]/55">
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
    <Section id="branches">
      <SectionHeading
        title="Two centres, one sound"
        blurb="Both branches share the same syllabus, faculty and studio standard, so a student can move between them without missing a beat."
      />
      <div className="grid gap-5 md:grid-cols-2">
        {branches.map((b, i) => (
          <Reveal key={b.name} delay={i * 0.1}>
            <article className="flex h-full flex-col rounded-[28px] border border-[#15141A]/10 bg-white/70 p-7 shadow-[0_1px_2px_rgba(21,20,26,0.04)] backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1">
              <span className="mb-5 inline-flex w-fit rounded-full border border-[#D6A84F]/40 bg-[#D6A84F]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A6A26]">
                {b.tag}
              </span>
              <h3 className="font-display text-2xl font-bold text-[#15141A]">{b.name}</h3>
              <p className="mt-1 text-sm font-medium text-[#8A6A26]">{b.address}</p>
              <p className="mt-5 text-sm leading-relaxed text-[#15141A]/65">{b.note}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function Cta() {
  return (
    <section className="relative bg-[#15141A]">
      <InkDivider />
      <div className="mx-auto w-full max-w-[88rem] px-6 py-20 md:py-28">
        <Reveal>
          <h2 className="max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-[#F6F4EF] md:text-6xl">
            Let&apos;s begin the lesson.
          </h2>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[#F6F4EF]/60">
            Slots are limited per batch. Log in as a student or staff member to view schedules,
            invoices and progress — all in one place.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href="/login"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#D6A84F] px-7 py-3.5 text-sm font-semibold text-[#15141A] transition-transform duration-300 hover:-translate-y-0.5"
            >
              Student / Staff Login
            </a>
            <a
              href="#courses"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#F6F4EF]/25 px-7 py-3.5 text-sm font-semibold text-[#F6F4EF] transition-colors duration-300 hover:border-[#F6F4EF]/60"
            >
              Browse courses
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#15141A]/10 bg-[#F6F4EF]">
      <div className="relative z-10 mx-auto flex w-full max-w-[88rem] flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#15141A]/15 font-display text-sm font-bold text-[#15141A]">
            स
          </span>
          <span className="text-sm text-[#15141A]/60">© 2026 Swar Mangal Music Academy</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#15141A]/65">
          <a href="#courses" className="transition-colors hover:text-[#15141A]">
            Courses
          </a>
          <a href="#faculty" className="transition-colors hover:text-[#15141A]">
            Faculty
          </a>
          <a href="#branches" className="transition-colors hover:text-[#15141A]">
            Find us
          </a>
          <a href="/login" className="transition-colors hover:text-[#15141A]">
            Student / Staff Login
          </a>
        </nav>
      </div>
    </footer>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="sm-landing relative font-sans">
      <div className="sm-grain" aria-hidden />
      {children}
    </div>
  );
}

export default function LandingPage() {
  return (
    <Shell>
      <LenisProvider>
        <main className="relative z-10">
          <HeroStage />
          <About />
          <Courses />
          <Experience />
          <Faculty />
          <Branches />
          <Cta />
          <Footer />
        </main>
      </LenisProvider>
    </Shell>
  );
}

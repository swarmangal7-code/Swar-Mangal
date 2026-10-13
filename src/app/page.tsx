import type { ReactNode } from "react";

import { LenisProvider } from "@/components/motion/lenis-provider";
import { Reveal } from "@/components/motion/reveal";
import { HeroStage } from "@/components/landing/hero-stage";
import { PaintStroke } from "@/components/landing/paint-stroke";
import { Section, SectionHeading, InkDivider } from "@/components/landing/section";
import { cn } from "@/lib/utils/cn";

// The release APK published on the VPS. This filename always serves the
// latest published build (see README "Build APK"), so the link never
// needs a version bump — same file the in-app updater and the dashboard
// header button already use.
const APK_DOWNLOAD_URL = "https://148.113.52.88.nip.io/downloads/swar-mangal.apk";

// Instrument swatches lifted for the ember-black ground — same six real
// instruments, same ragged-stroke motif, each paired with a text ink
// chosen per-swatch for contrast on dark.
const instruments = [
  {
    name: "Guitar",
    label: "Beginner to advanced",
    color: "#E8A83E",
    ink: "#201304",
  },
  {
    name: "Piano & Keys",
    label: "Beginner to advanced",
    color: "#6E68D6",
    ink: "#F4F1FF",
  },
  {
    name: "Vocal",
    label: "Hindustani · Semi-classical",
    color: "#D15460",
    ink: "#FBEFEA",
  },
  {
    name: "Tabla",
    label: "Layakari · Accompaniment",
    color: "#D2803F",
    ink: "#241105",
  },
  {
    name: "Violin",
    label: "Intermediate and up",
    color: "#3FA39A",
    ink: "#EAFBF8",
  },
  {
    name: "Flute",
    label: "Bamboo · Silver",
    color: "#5C9457",
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

/** One looped instrument ribbon between hero and content — a single
 *  marquee use, duplicated content for a seamless loop, paused entirely
 *  under reduced-motion. Real names only: six instruments, two centres. */
function InstrumentMarquee() {
  const items = [...instruments.map((i) => i.name), "Kandivali", "Goregaon"];
  const row = (hidden: boolean) => (
    <div aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {items.map((name) => (
        <span key={name} className="flex items-center">
          <span className="sm-telemetry px-6 text-xs uppercase tracking-[0.3em] text-[#F4EDE1]/45">
            {name}
          </span>
          <span aria-hidden className="text-[#D6A84F]/50">
            ✦
          </span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="sm-marquee relative border-y border-white/[0.07] bg-black/30 py-4">
      <div className="sm-marquee-track flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

function About() {
  return (
    <Section id="about">
      <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold leading-[1.1] tracking-tight text-[#F4EDE1] md:text-[2.75rem]">
            Where music becomes <em className="text-[#E8C57C]">discipline</em>
          </h2>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[#F4EDE1]/65">
            Swar Mangal is a real, operating music academy across two Mumbai studios. Students learn
            classical technique alongside contemporary repertoire, under teachers who still perform.
          </p>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#F4EDE1]/65">
            From a first chord to a professional&apos;s final polish, every lesson is individual,
            intentional and accountable — one teacher, one student, one instrument at a time.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="border-t border-[#D6A84F]/25 pt-8 font-display text-xl font-medium leading-relaxed text-[#F4EDE1] md:text-2xl">
            Two centres in Mumbai. Six instruments taught. Every lesson, one-to-one.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}

/** Paint-stroke bars, one ragged saturated shape per real instrument — the
 *  skill-bar motif translated into the academy's own content, never
 *  arbitrary and never a repeated icon+heading+text card. */
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
            <PaintStroke
              color={ins.color}
              ink={ins.ink}
              name={ins.name}
              label={ins.label}
              className="shadow-[0_18px_50px_-20px_rgba(0,0,0,0.8)]"
            />
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
              <h3 className="font-display text-2xl font-semibold text-[#F4EDE1]">{f.title}</h3>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[#F4EDE1]/60">{f.desc}</p>
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
              <h3 className="font-display text-xl font-semibold text-[#F4EDE1]">{f.name}</h3>
              <p className="sm-telemetry mt-2 text-[11px] uppercase tracking-[0.18em] text-[#D6A84F]/80">
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
            <article className="flex h-full flex-col rounded-[28px] border border-white/10 bg-white/[0.04] p-7 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#D6A84F]/30">
              <span className="sm-telemetry mb-5 inline-flex w-fit rounded-full border border-[#D6A84F]/30 bg-[#D6A84F]/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#E8C57C]">
                {b.tag}
              </span>
              <h3 className="font-display text-2xl font-semibold text-[#F4EDE1]">{b.name}</h3>
              <p className="mt-1 text-sm font-medium text-[#E8C57C]/90">{b.address}</p>
              <p className="mt-5 text-sm leading-relaxed text-[#F4EDE1]/60">{b.note}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function Cta() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          "radial-gradient(40rem 22rem at 50% 120%, rgba(178,58,72,0.22), transparent 65%)," +
          "linear-gradient(180deg, rgba(0,0,0,0.5), rgba(0,0,0,0))",
      }}
    >
      <InkDivider />
      <div className="mx-auto w-full max-w-[88rem] px-6 py-20 md:py-28">
        <Reveal>
          <h2 className="max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-tight text-[#F4EDE1] md:text-6xl">
            Let&apos;s begin <em className="text-[#E8C57C]">the lesson.</em>
          </h2>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[#F4EDE1]/60">
            Slots are limited per batch. Log in as a student or staff member to view schedules,
            invoices and progress — all in one place.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href="/login"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#D6A84F] px-7 py-3.5 text-sm font-semibold text-[#17100A] shadow-[0_8px_30px_-8px_rgba(214,168,79,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#E8C57C]"
            >
              Student / Staff Login
            </a>
            <a
              href="#courses"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#F4EDE1]/20 px-7 py-3.5 text-sm font-semibold text-[#F4EDE1] transition-colors duration-300 hover:border-[#D6A84F]/60 hover:text-[#E8C57C]"
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
    <footer className="border-t border-white/[0.07] bg-black/40">
      <div className="relative z-10 mx-auto flex w-full max-w-[88rem] flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D6A84F]/40 bg-[#D6A84F]/10 font-display text-sm font-semibold text-[#E8C57C]">
            स
          </span>
          <span className="text-sm text-[#F4EDE1]/55">© 2026 Swar Mangal Music Academy</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#F4EDE1]/60">
          <a href="#courses" className="transition-colors hover:text-[#E8C57C]">
            Courses
          </a>
          <a href="#faculty" className="transition-colors hover:text-[#E8C57C]">
            Faculty
          </a>
          <a href="#branches" className="transition-colors hover:text-[#E8C57C]">
            Find us
          </a>
          <a href="/login" className="transition-colors hover:text-[#E8C57C]">
            Student / Staff Login
          </a>
          <a href={APK_DOWNLOAD_URL} download className="transition-colors hover:text-[#E8C57C]">
            Android app
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
          <InstrumentMarquee />
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

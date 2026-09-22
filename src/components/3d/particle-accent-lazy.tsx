"use client";

import dynamic from "next/dynamic";

// Same reasoning as string-field-lazy.tsx: three.js is too large to sit in
// this page's initial JS, and `ssr: false` needs a Client Component
// boundary the App Router won't allow directly inside a Server Component.
export const ParticleAccentLazy = dynamic(
  () => import("@/components/3d/particle-accent").then((m) => m.ParticleAccent),
  { ssr: false },
);

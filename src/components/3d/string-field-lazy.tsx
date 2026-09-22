"use client";

import dynamic from "next/dynamic";

// three.js + @react-three/fiber are a genuinely large payload for a single
// hero flourish — kept off the landing page's initial JS entirely and
// fetched only after the browser has painted. `ssr: false` requires a
// Client Component boundary in the App Router, which is the only reason
// this file exists separately from the (server) page that uses it.
export const StringFieldLazy = dynamic(
  () => import("@/components/3d/string-field").then((m) => m.StringField),
  { ssr: false, loading: StringFallback },
);

function StringFallback() {
  return (
    <div aria-hidden className="absolute inset-0 flex items-center">
      <div
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(226,189,104,0.22) 48%, rgba(226,189,104,0.22) 52%, transparent 100%)",
        }}
      />
    </div>
  );
}

import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, Fraunces, Manrope, IBM_Plex_Mono, Tiro_Devanagari_Hindi } from "next/font/google";

import { ThemeProvider } from "@/components/ui/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/ui/query-provider";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// "Midnight Raga" type trio for the public marketing/forms surfaces
// (landing page, login, enroll, terms) only. These variables are defined
// here (next/font requires the generated className/variable to be mounted
// somewhere in the tree) but never applied as `--font-sans`/`--font-display`
// globally — `.sm-landing` in globals.css remaps those two variables to
// these, scoped to that class, so the founder/staff dashboards (which keep
// referencing `--font-sans`/`--font-display` directly via Tailwind's
// `font-sans`/`font-display` utilities) are completely unaffected.
// Fraunces (optical serif, classical-editorial voice) replaces the old
// geometric Syne; Manrope replaces Plus Jakarta Sans for body; IBM Plex
// Mono powers the telemetry readouts (branch codes, counts, status).
const midnightDisplay = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["500", "600", "700"],
  variable: "--font-display-alt",
  display: "swap",
});

const midnightSans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans-alt",
  display: "swap",
});

const midnightMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-alt",
  display: "swap",
});

// Devanagari voice for the Dawn Parampara world: the सा motif, the swar
// strip and section accents. Same scoping rules as the trio above —
// applied only inside `.sm-landing` via `--font-dev`.
const devanagari = Tiro_Devanagari_Hindi({
  subsets: ["devanagari", "latin"],
  style: ["normal", "italic"],
  weight: ["400"],
  variable: "--font-dev",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Swar Mangal — Music Academy",
  description: "Premium music class management platform for students, teachers, and academies.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0E0B09",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${display.variable} ${midnightDisplay.variable} ${midnightSans.variable} ${midnightMono.variable} ${devanagari.variable} font-sans`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>{children}</QueryProvider>
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}

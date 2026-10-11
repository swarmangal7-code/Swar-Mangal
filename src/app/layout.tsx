import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, Syne, Plus_Jakarta_Sans } from "next/font/google";

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

// New-world type pair for the public marketing/forms redesign (landing
// page, login, enroll, terms) only. These variables are defined here (next
// font requires the generated className/variable to be mounted somewhere
// in the tree) but never applied as `--font-sans`/`--font-display`
// globally — `.sm-landing` in globals.css remaps those two variables to
// these, scoped to that class, so the founder/staff dashboards (which keep
// referencing `--font-sans`/`--font-display` directly via Tailwind's
// `font-sans`/`font-display` utilities) are completely unaffected.
const syne = Syne({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-display-alt",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans-alt",
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
  themeColor: "#11161f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${display.variable} ${syne.variable} ${plusJakarta.variable} font-sans`}
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

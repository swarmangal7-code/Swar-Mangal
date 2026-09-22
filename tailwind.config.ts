import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Founder/staff dashboard shell's own near-black + gold world —
        // separate from the tokens above (which the legacy dashboard group
        // and marketing pages use). See globals.css for light/dark values.
        dash: {
          bg: "hsl(var(--dash-bg) / <alpha-value>)",
          sidebar: "hsl(var(--dash-sidebar) / <alpha-value>)",
          elevated: "hsl(var(--dash-elevated) / <alpha-value>)",
          surface: "hsl(var(--dash-surface) / <alpha-value>)",
          card: "hsl(var(--dash-card) / <alpha-value>)",
          fg: "hsl(var(--dash-fg) / <alpha-value>)",
          accent: "hsl(var(--dash-accent) / <alpha-value>)",
          "accent-hover": "hsl(var(--dash-accent-hover) / <alpha-value>)",
        },
        navy: {
          50: "#f5f7fa",
          100: "#e9edf3",
          200: "#cfd8e6",
          300: "#a7b7cd",
          400: "#7a90ae",
          500: "#597292",
          600: "#465b79",
          700: "#3b4c63",
          800: "#28364a",
          900: "#1b2533",
          950: "#11161f",
        },
        violet: {
          50: "#f5f0ff",
          100: "#ede5ff",
          200: "#daccff",
          300: "#bfa5ff",
          400: "#a078ff",
          500: "#8649f5",
          600: "#7728e8",
          700: "#6620cc",
          800: "#551eaa",
          900: "#471c88",
        },
        lavender: {
          50: "#f6f4ff",
          100: "#eeebff",
          200: "#ded9ff",
          300: "#c5bbff",
          400: "#a894fc",
          500: "#8d6bf6",
          600: "#7d4eea",
          700: "#6a3bd0",
          800: "#5931ab",
          900: "#4b2c89",
        },
        mint: {
          50: "#effdf6",
          100: "#d9fbe9",
          200: "#b5f4d4",
          300: "#84e9ba",
          400: "#52d69b",
          500: "#2dbd7f",
          600: "#1f9c67",
          700: "#1a7c54",
          800: "#186244",
          900: "#155039",
        },
        peach: {
          50: "#fff8f0",
          100: "#ffeed9",
          200: "#ffdcb2",
          300: "#ffc281",
          400: "#ffae5e",
          500: "#ff8f3f",
          600: "#f06b1f",
          700: "#c35016",
          800: "#9b3f16",
          900: "#7d3518",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 6px)",
        sm: "calc(var(--radius) - 10px)",
        "2xl": "calc(var(--radius) + 6px)",
        "3xl": "calc(var(--radius) + 12px)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        soft: "var(--shadow-soft)",
        lift: "var(--shadow-lift)",
        float: "var(--shadow-float)",
        glow: "var(--shadow-glow)",
        "soft-lg": "var(--shadow-lift)",
        card: "var(--shadow-xs)",
        nav: "0 -4px 24px -12px rgb(19 24 38 / 0.24)",
      },
      transitionTimingFunction: {
        "ease-out-expo": "cubic-bezier(0.22, 1, 0.36, 1)",
        "ease-in-out-quad": "cubic-bezier(0.65, 0, 0.35, 1)",
        spring: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 2s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;

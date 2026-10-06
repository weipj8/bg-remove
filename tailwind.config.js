/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Graphite surfaces. `ink-950` is the page, `ink-800` a panel, `ink-700` a
        // raised control, and `line` the hairline that does most of the structure.
        ink: {
          950: "#080A0C",
          900: "#0E1216",
          800: "#151B21",
          700: "#1E262E",
        },
        line: "#2A343E",
        paper: "#EDEFF2",
        mute: "#8CA0AF",
        lime: { DEFAULT: "#C4F135", dim: "#9BC11E" },
        coral: "#FF6B5E",
        amber: "#FFC44D",
      },
      fontFamily: {
        // Self-hosted under public/fonts/ — COEP blocks remote fonts, so these names
        // must match the @font-face rules in src/index.css and nothing else.
        display: ['"Instrument Serif"', "Georgia", "serif"],
        sans: ['"Spline Sans"', "system-ui", "sans-serif"],
        mono: ['"Spline Sans Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.04em" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.25rem", { lineHeight: "1.75rem" }],
        xl: ["1.625rem", { lineHeight: "1.9rem", letterSpacing: "-0.015em" }],
        "2xl": ["2.125rem", { lineHeight: "2.3rem", letterSpacing: "-0.025em" }],
        "3xl": ["3rem", { lineHeight: "3.1rem", letterSpacing: "-0.03em" }],
        "4xl": ["4rem", { lineHeight: "4rem", letterSpacing: "-0.035em" }],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
      },
      boxShadow: {
        card: "0 0 0 1px #2A343E, 0 24px 48px -24px rgb(0 0 0 / 0.7)",
        raised: "0 0 0 1px #2A343E, 0 8px 20px -12px rgb(0 0 0 / 0.6)",
        accent:
          "0 0 0 1px rgba(196, 241, 53, 0.35), 0 0 32px -8px rgba(196, 241, 53, 0.25)",
      },
      letterSpacing: {
        display: "-0.035em",
        label: "0.14em",
      },
      maxWidth: {
        page: "78rem",
        prose: "42rem",
      },
    },
  },
  plugins: [],
};

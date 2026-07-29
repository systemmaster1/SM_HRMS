import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /* Brand blue — anchored on Deep Cobalt #1A4B9F (official primary) */
        brand: {
          50:  "#EBF3FB",
          100: "#D5EAF7",   // Sleek Sky Blue
          200: "#AFD4EF",
          300: "#70C9E8",   // Luminous Sky Blue
          400: "#3D8FD4",
          500: "#2464BE",
          600: "#1A4B9F",   // Deep Cobalt Blue — PRIMARY
          700: "#163F86",
          800: "#12336C",
          900: "#0D264F",
        },
        /* Accent — Sunburst Orange #F68D2B into Rich Copper #BB6E2B */
        accent: {
          50:  "#FEF4E8",
          100: "#FCE3C6",
          200: "#FACB93",
          300: "#F8AE5E",
          400: "#F68D2B",   // Sunburst Orange — PRIMARY ACCENT
          500: "#E07A22",
          600: "#BB6E2B",   // Rich Copper
          700: "#8F531F",
        },
        /* Neutral tint from the brand sheet */
        silver: "#E1E5EB",  // Reflective Silver-Grey
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      /* layered, soft shadows — cards feel lifted instead of flat */
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -12px rgba(15,23,42,0.12)",
        "card-hover": "0 2px 4px rgba(15,23,42,0.05), 0 18px 44px -16px rgba(5,58,110,0.28)",
        glow: "0 0 0 1px rgba(232,121,42,0.25), 0 4px 20px -4px rgba(232,121,42,0.45)",
      },
      /* reusable brand gradients */
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #2464BE 0%, #1A4B9F 55%, #12336C 100%)",
        "accent-gradient": "linear-gradient(135deg, #F8AE5E 0%, #F68D2B 55%, #BB6E2B 100%)",
        "sidebar-gradient": "linear-gradient(180deg, #163F86 0%, #0D264F 58%, #081B3A 100%)",
        "hero-gradient": "linear-gradient(140deg, #1A4B9F 0%, #12336C 50%, #0D264F 100%)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;

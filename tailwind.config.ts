import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#EEF4FA",
          100: "#D6E4F2",
          200: "#AFC9E3",
          300: "#7BA5CE",
          400: "#4A7DB4",
          500: "#1F5A96",
          600: "#0E4478",
          700: "#053A6E",   // primary navy (from logo)
          800: "#042C54",
          900: "#031E3A",
        },
        accent: {
          50:  "#FEF3E9",
          100: "#FCE1C7",
          200: "#F8C093",
          300: "#F4A15F",
          400: "#F08A3C",
          500: "#E8792A",   // logo orange
          600: "#CC621B",
          700: "#A64C14",
        },
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
        "brand-gradient": "linear-gradient(135deg, #0E4478 0%, #053A6E 55%, #042C54 100%)",
        "accent-gradient": "linear-gradient(135deg, #F08A3C 0%, #E8792A 60%, #CC621B 100%)",
        "sidebar-gradient": "linear-gradient(180deg, #04294D 0%, #031E3A 58%, #021226 100%)",
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

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
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
    },
  },
  plugins: [],
};
export default config;

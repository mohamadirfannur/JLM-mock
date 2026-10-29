import type { Config } from "tailwindcss";

// Palette carried over from the Surge / Cartogram UI (light theme).
// JLM brand (Figma: JLM - Map Planner / Brand Guideline)
const jcyan = { 50: "#E6FBFF", 100: "#CCF6FF", 200: "#99EEFF", 300: "#66E5FF", 400: "#33DDFF", 500: "#00D4FF", 600: "#00AACC", 700: "#007F99", 800: "#005566", 900: "#002A33", 950: "#00151A" };
const j = {
  ink: "#10201D", sub: "#51625E", mute: "#748D88", line: "#E1E8E6", bg: "#F5F9F8", soft: "#EFF5FA",
  cyan: "#00D4FF", purple: "#7B2FFF", teal: "#005952", blue: "#0E66C4", amber: "#F59E0B", red: "#EF4444", slate: "#61718B", aqua: "#3ECFD2", navy: "#001849",
};
const colors = {
  jcyan,
  j,
  current: "currentColor",
  transparent: "transparent",
  white: "#FFFFFF",
  black: "#000000",
  brand: {
    50: "#F5F5F9", 100: "#C4C7D9", 200: "#9399B7", 300: "#626D92", 400: "#31416B",
    500: "#011641", 600: "#00113C", 700: "#000C34", 800: "#00082A", 900: "#00041E", 950: "#000211",
  },
  grey: {
    50: "#FEFEFE", 100: "#EFEFEF", 200: "#E4E3E4", 300: "#AFAEAF", 400: "#949495",
    500: "#79797B", 600: "#626264", 700: "#4C4B4C", 800: "#353435", 900: "#1E1D1E", 950: "#060606",
  },
  green: {
    50: "#E6FAF2", 100: "#B8F2D9", 200: "#8AE9C0", 300: "#5CE1A7", 400: "#2ED88E",
    500: "#00D075", 600: "#00A05B", 700: "#007041", 800: "#004027", 900: "#021A12", 950: "#043A24",
  },
  blue: {
    50: "#F3F7FF", 100: "#E3ECFF", 200: "#7CABFF", 300: "#538CFF", 400: "#3672F9",
    500: "#205CD9", 600: "#0F47B3", 700: "#03348C", 800: "#002466", 900: "#011641", 950: "#00081A",
  },
  red: {
    50: "#FAEDEE", 100: "#EDBEC1", 200: "#DF8F94", 300: "#D06169", 400: "#C0353E",
    500: "#AF0914", 600: "#98060F", 700: "#81030B", 800: "#690108", 900: "#500005", 950: "#360003",
  },
  yellow: {
    50: "#FFFBEB", 100: "#FEF3C7", 200: "#FDE68A", 300: "#FCD34D", 400: "#FBBF24",
    500: "#F59E0B", 600: "#D97706", 700: "#B45309", 800: "#92400E", 900: "#78350F", 950: "#451A03",
  },
  orange: {
    50: "#FFF7ED", 100: "#FFEDD5", 200: "#FED7AA", 300: "#FDBA74", 400: "#FB923C",
    500: "#F97316", 600: "#EA580C", 700: "#C2410C", 800: "#9A3412", 900: "#7C2D12", 950: "#431407",
  },
  purple: {
    50: "#FAF5FF", 100: "#F3E8FF", 200: "#E9D5FF", 300: "#D8B4FE", 400: "#C084FC",
    500: "#A855F7", 600: "#9333EA", 700: "#7E22CE", 800: "#6B21A8", 900: "#581C87", 950: "#3B0764",
  },
  cyan: {
    50: "#ECFEFF", 100: "#CFFAFE", 200: "#A5F3FC", 300: "#67E8F9", 400: "#22D3EE",
    500: "#06B6D4", 600: "#0891B2", 700: "#0E7490", 800: "#155E75", 900: "#164E63", 950: "#083344",
  },
};

// Nuxt UI "primary" (mapped to brand via app.config) — declared explicitly so dev & build behave the same.
const v = (k: string) => `rgb(var(--color-primary-${k}) / <alpha-value>)`;
const primary: Record<string, string> = { DEFAULT: v("DEFAULT") };
[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].forEach((n) => (primary[n] = v(String(n))));

export default <Partial<Config>>{
  theme: {
    borderRadius: {
      none: "0", xxs: "4px", xs: "8px", sm: "12px", md: "16px", lg: "20px",
      xl: "24px", xxl: "32px", full: "9999px", DEFAULT: "4px",
    },
    extend: {
      colors: { ...colors, primary },
      fontSize: { "2xs": ["10px", "16px"] },
      fontFamily: { display: ["\"Exo 2\"", "Inter", "sans-serif"], sans: ["Inter", "sans-serif"] },
    },
  },
};

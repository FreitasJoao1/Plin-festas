import type { Config } from "tailwindcss";

// Sistema de tokens da marca Plin Festas.
// Rosa + branco como base, lilás e azul-bebê como acento — conforme briefing.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        pink: {
          50: "#FFF3F7",
          100: "#FFE3ED",
          200: "#FFC7DC",
          300: "#FF9EC1",
          400: "#FF6FA0",
          500: "#F2578C", // rosa principal da marca
          600: "#DB3B70",
          700: "#B8285A",
          800: "#8F1F47",
          900: "#5E1530",
        },
        lilac: {
          100: "#F2ECFB",
          200: "#E1D2F5",
          300: "#C9AEEA",
          400: "#AD87DC",
          500: "#8F63C7",
        },
        babyblue: {
          100: "#EAF7FD",
          200: "#CFEDFA",
          300: "#AEE0F5",
          400: "#82CBE9",
          500: "#57AFD4",
        },
        ink: {
          DEFAULT: "#3A2E39", // texto principal — plum escuro, não preto puro
          soft: "#6B5A68",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      borderRadius: {
        "3xl": "1.75rem",
      },
      keyframes: {
        // Vai de -50% até 0: o conteúdo (duplicado 2x) desliza da
        // esquerda para a direita, como pedido no briefing.
        marquee: {
          "0%": { transform: "translateX(-50%)" },
          "100%": { transform: "translateX(0%)" },
        },
      },
      animation: {
        marquee: "marquee 32s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;

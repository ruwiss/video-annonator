/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/renderer/**/*.{js,ts,jsx,tsx,html}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Bebas Neue", "Impact", "sans-serif"],
        body: ["Outfit", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        cinema: {
          black: "#0a0a0b",
          darker: "#0e0e10",
          dark: "#111113",
          surface: "#18181b",
          elevated: "#1f1f23",
          border: "rgba(212, 165, 116, 0.12)",
          "border-strong": "rgba(212, 165, 116, 0.25)",
        },
        amber: {
          glow: "#d4a574",
          warm: "#e8b882",
          light: "#f5c98a",
          muted: "rgba(212, 165, 116, 0.6)",
        },
        silver: {
          DEFAULT: "#a8a9b4",
          light: "#c4c5d0",
          muted: "#6b6b78",
        },
        accent: {
          primary: "#d4a574",
          secondary: "#a78bfa",
          success: "#4ade80",
          warning: "#fbbf24",
          danger: "#e85d5d",
        },
      },
      backgroundImage: {
        "grain": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
        "diagonal-lines": "repeating-linear-gradient(135deg, rgba(212, 165, 116, 0.03) 0px, rgba(212, 165, 116, 0.03) 1px, transparent 1px, transparent 12px)",
      },
      boxShadow: {
        "glow-sm": "0 0 10px -3px rgba(212, 165, 116, 0.3)",
        "glow": "0 0 20px -5px rgba(212, 165, 116, 0.4)",
        "glow-lg": "0 0 30px -5px rgba(212, 165, 116, 0.5)",
        "inner-glow": "inset 0 1px 0 0 rgba(255, 255, 255, 0.05)",
        "cinematic": "0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(212, 165, 116, 0.1)",
        "elevated": "0 10px 40px -10px rgba(0, 0, 0, 0.6)",
      },
      backdropBlur: {
        panel: "16px",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "glow-pulse": "glowPulse 2.5s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "film-grain": "filmGrain 0.5s steps(10) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px -5px rgba(212, 165, 116, 0.3)" },
          "50%": { boxShadow: "0 0 25px -3px rgba(212, 165, 116, 0.5)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        filmGrain: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "10%": { transform: "translate(-1%, -1%)" },
          "20%": { transform: "translate(1%, 1%)" },
          "30%": { transform: "translate(-1%, 1%)" },
          "40%": { transform: "translate(1%, -1%)" },
          "50%": { transform: "translate(-1%, 0%)" },
          "60%": { transform: "translate(1%, 0%)" },
          "70%": { transform: "translate(0%, 1%)" },
          "80%": { transform: "translate(0%, -1%)" },
          "90%": { transform: "translate(1%, 1%)" },
        },
      },
    },
  },
  plugins: [],
};

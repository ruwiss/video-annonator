/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/renderer/**/*.{js,ts,jsx,tsx,html}"],
  theme: {
    extend: {
      colors: {
        overlay: {
          bg: "rgba(0, 0, 0, 0.85)",
          panel: "rgba(24, 24, 27, 0.95)",
          border: "rgba(63, 63, 70, 0.5)",
        },
        accent: {
          primary: "#3b82f6",
          secondary: "#8b5cf6",
          success: "#22c55e",
          warning: "#f59e0b",
          danger: "#ef4444",
        },
      },
      backdropBlur: {
        panel: "12px",
      },
      animation: {
        "fade-in": "fadeIn 0.15s ease-out",
        "slide-up": "slideUp 0.2s ease-out",
        "pulse-subtle": "pulseSubtle 2s infinite",
        "scale-in": "scaleIn 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

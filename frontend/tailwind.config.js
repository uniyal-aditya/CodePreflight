export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      keyframes: {
        "fade-up": { from: { opacity: 0, transform: "translateY(14px)" }, to: { opacity: 1, transform: "none" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        progress: { from: { width: "0%" }, to: { width: "100%" } },
        confetti: { from: { transform: "translateY(-10vh) rotate(0deg)", opacity: 1 }, to: { transform: "translateY(110vh) rotate(540deg)", opacity: 0.9 } },
        word: { "0%": { opacity: 0, transform: "translateY(10px)" }, "15%,85%": { opacity: 1, transform: "none" }, "100%": { opacity: 0, transform: "translateY(-10px)" } },
      },
      animation: { "fade-up": "fade-up .5s ease both", float: "float 2.4s ease-in-out infinite", progress: "progress linear forwards", confetti: "confetti linear forwards", word: "word 2.4s ease both" },
    },
  },
  plugins: [],
};

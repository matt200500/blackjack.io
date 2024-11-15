/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Titillium Web", "sans-serif"],
      },
      keyframes: {
        "fade-in-out": {
          "0%, 100%": { opacity: 0 },
          "10%, 90%": { opacity: 1 },
        },
      },
      animation: {
        "fade-in-out": "fade-in-out 3s ease-in-out",
      },
    },
  },
  plugins: [require("tailwind-scrollbar")],
  variants: {
    extend: {
      display: ["portrait", "landscape"],
    },
  },
};

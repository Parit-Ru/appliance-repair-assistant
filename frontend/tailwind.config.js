/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#0B0F1A",
        panel: "#0E1422",
        line: "#1E293B",
        accent: "#F59E0B",

        ink: {
          DEFAULT: "#F1F5F9",
          soft: "#94A3B8",
          faint: "#78879D",
        },

        success: "#4ADE80",
        info: "#60A5FA",
        danger: "#F87171",
      },

      fontFamily: {
        sans: ['"Leelawadee UI"', '"Noto Sans Thai"', "Thonburi", "Tahoma", "sans-serif"],
        mono: ["Consolas", '"Courier New"', "monospace"],
      },
    },
  },
  plugins: [],
}
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          DEFAULT: '#FAF7F0',
          soft: '#F5F0E1',
          dim: '#EFE9D8',
        },
        ink: {
          DEFAULT: '#1F2937',
          soft: '#475569',
          mute: '#94A3B8',
        },
      },
      fontFamily: {
        brand: ['"Noto Serif TC"', '"Noto Serif JP"', 'serif'],
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1F2937',
          soft: '#475569',
          mute: '#94A3B8',
        },
        highlight: 'rgb(var(--color-highlight) / <alpha-value>)',
        focus: 'rgb(var(--color-focus) / <alpha-value>)',
        surface: {
          muted: 'rgb(var(--color-surface-muted) / <alpha-value>)',
        },
        divider: 'rgb(var(--color-divider) / <alpha-value>)',
        brand: 'rgb(var(--color-brand) / <alpha-value>)',
      },
      fontFamily: {
        brand: ['"Noto Serif TC"', '"Noto Serif JP"', 'serif'],
      },
    },
  },
  plugins: [],
}

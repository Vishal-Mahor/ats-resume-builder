/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['DM Sans', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
        mono:  ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#e6f3ee',
          100: '#c0ddd0',
          500: '#2d9668',
          600: '#1a6b4a',
          700: '#145438',
        },
      },
      borderRadius: {
        DEFAULT: '10px',
        lg: '16px',
      },
    },
  },
  plugins: [],
};

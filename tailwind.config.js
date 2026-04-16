/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:   '#edeef6',
          100:  '#c7cadf',  // avatars, light backgrounds
          200:  '#a1a6c8',
          300:  '#7b83b1',
          400:  '#555f9a',
          500:  '#3a4483',
          600:  '#262e63',  // PRIMARY — color exacto del logo
          700:  '#1c2249',
          800:  '#121630',
          900:  '#080b18',
          DEFAULT: '#262e63',
        },
      },
    },
  },
  plugins: [],
};

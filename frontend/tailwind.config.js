/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#e8ecf3',
          100: '#c5d0e0',
          200: '#9fb0cb',
          300: '#7990b6',
          400: '#5e78a7',
          500: '#436098',
          600: '#3b5590',
          700: '#304785',
          800: '#26397a',
          900: '#132060',
          950: '#071428',
        },
        gold: {
          50: '#fdf9ec',
          100: '#faf1cc',
          200: '#f5e09a',
          300: '#edca61',
          400: '#e6b73a',
          500: '#C9A84C',
          600: '#b8902a',
          700: '#9a7121',
          800: '#7f5921',
          900: '#6a4920',
          950: '#3d2710',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-navy': 'linear-gradient(135deg, #071428 0%, #0d2144 100%)',
      },
    },
  },
  plugins: [],
};

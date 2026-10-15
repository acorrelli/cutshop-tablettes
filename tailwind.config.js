/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bottle: {
          DEFAULT: '#164734',
          950: '#0A2219',
          900: '#0E2F23',
          800: '#123D2D',
          700: '#164734',
          600: '#1D5A43',
          500: '#267255',
          400: '#3C8C6C',
        },
        gold: {
          DEFAULT: '#D4A84B',
          300: '#EBCB85',
          400: '#E0B966',
          500: '#D4A84B',
          600: '#B88C33',
          700: '#8F6B22',
        },
        cream: {
          DEFAULT: '#F4EBD9',
          50: '#FCF9F3',
          100: '#F8F2E6',
          200: '#F4EBD9',
          300: '#E8D9BC',
          400: '#D6C19A',
        },
        ink: '#0B0B0B',
      },
      fontFamily: {
        sans: ['Arial', 'Helvetica', 'sans-serif'],
      },
      boxShadow: {
        tile: '0 10px 30px rgba(0,0,0,0.35)',
        glow: '0 0 0 4px rgba(212,168,75,0.35)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop': {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '70%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-120%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s ease-out both',
        'pop': 'pop 0.5s cubic-bezier(.2,.9,.3,1.2) both',
        'float': 'float 6s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        'slide-down': 'slide-down 0.4s ease-out both',
        'spin-slow': 'spin-slow 40s linear infinite',
      },
    },
  },
  plugins: [],
};

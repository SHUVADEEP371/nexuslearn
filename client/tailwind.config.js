/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light mode palette
        light: {
          bg: '#f6f6fa',
          card: '#fff',
          primary: '#6d4aff',
          secondary: '#fbbf24',
          accent: '#f472b6',
          text: '#22223b',
          muted: '#a1a1aa',
        },
        // Dark mode palette
        dark: {
          bg: '#2d2540',
          card: '#3d3456',
          primary: '#a78bfa',
          secondary: '#fbbf24',
          accent: '#f472b6',
          text: '#f8fafc',
          muted: '#a1a1aa',
        },
        // For direct use
        indigo: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        // Brand palette from user
        brand: {
          night: '#0C0420',
          plum: '#5D3C64',
          mauve: '#7B466A',
          orchid: '#9F6496',
          pink: '#D391B0',
          blush: '#BA6E8F',
        },
        beige: {
          50: '#fdf6ee',
          100: '#f7ecd9',
          200: '#f3e3c9',
          300: '#f0d9b8',
          400: '#eacfa7',
          500: '#e2c896',
        },
        brown: {
          50: '#ede7e3',
          100: '#d6cfc7',
          200: '#bcae9e',
          300: '#a1846b',
          400: '#8a6a4f',
          500: '#6d4c2b',
          600: '#5a3e22',
        },
        accent: {
          100: '#fff7ed',
          200: '#ffe4c7',
          300: '#ffd6a5',
          400: '#ffb86b',
          500: '#ff944d',
        },
        white: '#fff',
        black: '#18181b',
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      fontFamily: {
        sans: ['Nunito', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 24px 0 rgba(0,0,0,0.08)',
        'card-lg': '0 8px 32px 0 rgba(0,0,0,0.12)',
      },
      transitionProperty: {
        'colors': 'background-color, border-color, color, fill, stroke',
      },
    },
  },
  plugins: [],
} 
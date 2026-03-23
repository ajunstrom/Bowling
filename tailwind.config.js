/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Contest color tokens
        bracket: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe',
          500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 900: '#1e3a8a',
        },
        eliminator: {
          50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe',
          500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 900: '#4c1d95',
        },
        highgame: {
          50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4',
          500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 900: '#134e4a',
        },
        highseries: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a',
          500: '#f59e0b', 600: '#d97706', 700: '#b45309', 900: '#78350f',
        },
        doubles: {
          50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8',
          500: '#ec4899', 600: '#db2777', 700: '#be185d', 900: '#831843',
        },
      },
    },
  },
  plugins: [],
}

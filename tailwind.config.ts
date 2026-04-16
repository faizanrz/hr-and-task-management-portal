import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#E63946',
          50: '#3D1519',
          100: '#4D1A20',
          200: '#6B2028',
          300: '#8E2A34',
          400: '#C43040',
          500: '#E63946',
          600: '#F05A65',
          700: '#F57D85',
          800: '#FAA6AB',
          900: '#FDD3D6',
        },
        success: {
          DEFAULT: '#22C55E',
          50: '#0D2818',
          100: '#14532D',
          200: '#166534',
          300: '#15803D',
          400: '#16A34A',
          500: '#22C55E',
          600: '#4ADE80',
          700: '#86EFAC',
          800: '#BBF7D0',
          900: '#DCFCE7',
        },
        danger: {
          DEFAULT: '#EF4444',
          50: '#3D1515',
          100: '#7F1D1D',
          500: '#EF4444',
          600: '#F87171',
        },
        warning: {
          DEFAULT: '#EF9F27',
          50: '#3D2E0F',
          100: '#78350F',
          500: '#EF9F27',
          600: '#F5B744',
        },
        surface: {
          DEFAULT: '#171717',
          dark: '#171717',
          mid: '#1e1e1e',
          card: '#252525',
          hover: '#2f2f2f',
          border: '#333333',
        },
      },
    },
  },
  plugins: [],
}

export default config

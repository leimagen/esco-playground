import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0d0f14',
          surface: '#161920',
          elevated: '#1e2230',
        },
        border: '#2a2f3d',
        text: {
          primary: '#e8eaf0',
          secondary: '#8891a8',
        },
        accent: {
          teal: '#3ddbd9',
          amber: '#d4a847',
          rose: '#c05c7e',
          violet: '#7c6fcd',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config

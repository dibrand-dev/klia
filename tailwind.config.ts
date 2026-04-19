import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F4F7FF',
          100: '#EAF0FE',
          200: '#C8D6F9',
          300: '#9AB2F0',
          400: '#5A83E6',
          500: '#3462DC',
          600: '#1F4FD9',
          700: '#1940B0',
          800: '#16389F',
          900: '#112E88',
        },
        ink: {
          DEFAULT: '#0B1220',
          2: '#1F2937',
        },
        muted: {
          DEFAULT: '#5B6472',
          2: '#8A93A1',
          3: '#AEB5C0',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          2: '#F6F7F9',
          3: '#F1F3F6',
        },
        line: {
          DEFAULT: '#E7E9EE',
          strong: '#D6DAE1',
        },
        bgc: '#FBFBFC',
        accent: {
          DEFAULT: '#1F4FD9',
          ink: '#16389F',
          soft: '#EAF0FE',
          'soft-2': '#F4F7FF',
        },
        ok: {
          DEFAULT: '#0E8A5F',
          soft: '#E7F5EE',
        },
        warn: {
          DEFAULT: '#A65A06',
          soft: '#FBF1E2',
        },
        danger: {
          DEFAULT: '#B42318',
          soft: '#FBECEA',
        },
        violet: {
          DEFAULT: '#5B3DC9',
          soft: '#EEEAFB',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'klin-sm': '0 1px 0 rgba(16,24,40,.02), 0 1px 2px rgba(16,24,40,.04)',
        'klin-md': '0 2px 4px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.06)',
        'klin-lg': '0 8px 24px rgba(16,24,40,.08), 0 24px 64px rgba(16,24,40,.10)',
      },
      borderRadius: {
        'klin-sm': '6px',
        'klin-md': '8px',
        'klin-lg': '12px',
        'klin-xl': '16px',
      },
    },
  },
  plugins: [],
}
export default config

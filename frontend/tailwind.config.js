/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    // The whole type scale. Larger utility names are kept as aliases so there
    // are only six sizes in the app: 12 caption · 14 secondary · 16 body ·
    // 20 title · 28 number · 40 the one hero number on a screen.
    fontSize: {
      xs:   ['0.75rem',  { lineHeight: '1rem' }],
      sm:   ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem',     { lineHeight: '1.5rem' }],
      lg:   ['1.25rem',  { lineHeight: '1.75rem' }],
      xl:   ['1.25rem',  { lineHeight: '1.75rem' }],
      '2xl': ['1.75rem', { lineHeight: '2.125rem' }],
      '3xl': ['1.75rem', { lineHeight: '2.125rem' }],
      '4xl': ['2.5rem',  { lineHeight: '2.75rem' }],
      '5xl': ['2.5rem',  { lineHeight: '2.75rem' }],
      '6xl': ['2.5rem',  { lineHeight: '2.75rem' }],
    },
    // Two radii: 12px for every container, input and button; full for chips,
    // pills and toggles.
    borderRadius: {
      none: '0', sm: '0.75rem', DEFAULT: '0.75rem', md: '0.75rem', lg: '0.75rem',
      xl: '0.75rem', '2xl': '0.75rem', '3xl': '0.75rem', full: '9999px',
    },
    extend: {
      colors: {
        surface: {
          base: token('surface-base'), card: token('surface-card'), elevated: token('surface-elevated'),
          border: token('surface-border'), muted: token('surface-muted'),
        },
        brand:   { DEFAULT: token('brand'), light: token('brand-light'), dark: token('brand-dark') },
        onbrand: token('on-brand'),
        success: { DEFAULT: token('success'), light: token('success-light') },
        warning: { DEFAULT: token('warning'), light: token('warning-light') },
        danger:  { DEFAULT: token('danger'),  light: token('danger-light') },
        info:    { DEFAULT: token('info'),    light: token('info-light') },
        cat: {
          diet: token('cat-diet'), fasting: token('cat-fasting'),
          workout: token('cat-workout'), sleep: token('cat-sleep'),
        },
        text: {
          primary: token('text-primary'), secondary: token('text-secondary'), muted: token('text-muted'),
        },
      },
      fontFamily: {
        sans: ['Inter Variable', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':  'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { transform: 'translateY(12px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
      },
    },
  },
  plugins: [],
}

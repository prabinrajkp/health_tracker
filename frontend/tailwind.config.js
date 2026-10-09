/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          base:     'rgb(var(--c-surface-base) / <alpha-value>)',
          card:     'rgb(var(--c-surface-card) / <alpha-value>)',
          elevated: 'rgb(var(--c-surface-elevated) / <alpha-value>)',
          border:   'rgb(var(--c-surface-border) / <alpha-value>)',
          muted:    'rgb(var(--c-surface-muted) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--c-brand) / <alpha-value>)',
          light:   'rgb(var(--c-brand-light) / <alpha-value>)',
          dark:    'rgb(var(--c-brand-dark) / <alpha-value>)',
          muted:   'rgb(var(--c-brand) / 0.13)',
        },
        success: {
          DEFAULT: 'rgb(var(--c-success) / <alpha-value>)',
          light:   'rgb(var(--c-success-light) / <alpha-value>)',
          muted:   'rgb(var(--c-success) / 0.13)',
        },
        warning: {
          DEFAULT: 'rgb(var(--c-warning) / <alpha-value>)',
          light:   'rgb(var(--c-warning-light) / <alpha-value>)',
          muted:   'rgb(var(--c-warning) / 0.13)',
        },
        danger: {
          DEFAULT: 'rgb(var(--c-danger) / <alpha-value>)',
          light:   'rgb(var(--c-danger-light) / <alpha-value>)',
          muted:   'rgb(var(--c-danger) / 0.13)',
        },
        info: {
          DEFAULT: 'rgb(var(--c-info) / <alpha-value>)',
          light:   'rgb(var(--c-info-light) / <alpha-value>)',
          muted:   'rgb(var(--c-info) / 0.13)',
        },
        text: {
          primary:   'rgb(var(--c-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--c-text-secondary) / <alpha-value>)',
          muted:     'rgb(var(--c-text-muted) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        card:           'var(--shadow-card)',
        'card-hover':   'var(--shadow-card-hover)',
        glow:           'var(--shadow-glow)',
        nav:            'var(--shadow-nav)',
        'glow-success': '0 4px 20px rgba(52,168,83,0.35)',
        'glow-brand':   '0 4px 20px rgba(124,58,237,0.45)',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'bar-fill':   'barFill 0.8s ease-out',
        'count-up':   'fadeIn 0.6s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp:   { '0%': { transform: 'translateY(12px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        barFill:   { '0%': { width: '0%' }, '100%': { width: 'var(--bar-width)' } },
        pulseGlow: { '0%, 100%': { boxShadow: '0 0 8px rgba(124,58,237,0.4)' }, '50%': { boxShadow: '0 0 22px rgba(124,58,237,0.8)' } },
      },
    },
  },
  plugins: [],
}

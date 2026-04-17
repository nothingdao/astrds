/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'game-blue': '#4dc1f9',
        'game-green': '#4dff4d',
        'game-red': '#ff4d4d',
        // shadcn CSS variable tokens
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
        destructive: { DEFAULT: 'var(--destructive)' },
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        popover: { DEFAULT: 'var(--popover)', foreground: 'var(--popover-foreground)' },
      },
      fontFamily: {
        arcade: ['"Press Start 2P"', 'monospace'],
      },
      animation: {
        'fadeIn': 'fadeIn 0.5s ease-out',
        'glow': 'glow 1.5s ease-in-out infinite alternate',
        'blink': 'blink 1s infinite',
        'pulse': 'pulse 0.2s ease-in-out',
        'scale': 'scale 0.2s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          'from': {
            opacity: '0',
            transform: 'translateY(-20px)'
          },
          'to': {
            opacity: '1',
            transform: 'translateY(0)'
          }
        },
        glow: {
          'from': {
            textShadow: '0 0 10px #4dc1f9, 0 0 20px #4dc1f9, 0 0 30px #4dc1f9',
          },
          'to': {
            textShadow: '0 0 20px #4dc1f9, 0 0 30px #4dc1f9, 0 0 40px #4dc1f9',
          }
        },
        blink: {
          '0%, 100%': {
            opacity: '0',
          },
          '50%': {
            opacity: '1',
          }
        },
        countdownPulse: {
          '0%': {
            transform: 'scale(0.8)',
            opacity: '0'
          },
          '50%': {
            transform: 'scale(1.2)',
            opacity: '1'
          },
          '100%': {
            transform: 'scale(1)',
            opacity: '0'
          }
        },
        countdownExpand: {
          '0%': {
            transform: 'scale(1)',
            opacity: '0.5'
          },
          '100%': {
            transform: 'scale(2)',
            opacity: '0'
          }
        },
        readyGoPulse: {
          '0%': {
            transform: 'scale(0.8)',
            opacity: '0'
          },
          '50%': {
            transform: 'scale(1.1)',
            opacity: '1'
          },
          '100%': {
            transform: 'scale(1)',
            opacity: '1'
          }
        },
        pulse: {
          '0%, 100%': {
            transform: 'scale(1)',
          },
          '50%': {
            transform: 'scale(1.05)',
          }
        },
        scale: {
          '0%': {
            transform: 'scale(1)',
          },
          '100%': {
            transform: 'scale(1.1)',
          }
        },
      },
    },
  },
  plugins: [],
}

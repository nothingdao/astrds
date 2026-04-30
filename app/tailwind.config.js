/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Legacy arcade palette names, now theme-aware aliases.
        "game-blue": "var(--primary)",
        "game-green": "var(--text-success)",
        "game-red": "var(--destructive)",

        // shadcn semantic tokens (theme-aware via CSS vars)
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: { DEFAULT: "var(--destructive)" },
        card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },

        // Extended text hierarchy (theme-aware)
        // Usage: text-tx-primary, text-tx-secondary, text-tx-accent, etc.
        tx: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
          dim: "var(--text-dim)",
          accent: "var(--text-accent)",
          danger: "var(--text-danger)",
          warning: "var(--text-warning)",
          success: "var(--text-success)",
        },

        // Surface tokens (theme-aware)
        // Usage: bg-surface-base, bg-surface-overlay, bg-surface-panel, etc.
        surface: {
          base: "var(--surface-base)",
          overlay: "var(--surface-overlay)",
          panel: "var(--surface-panel)",
          tinted: "var(--surface-tinted)",
          subtle: "var(--surface-subtle)",
          medium: "var(--surface-medium)",
        },

        // Border tokens (theme-aware)
        // Usage: border-edge-subtle, border-edge-accent, etc.
        edge: {
          subtle: "var(--border-subtle)",
          medium: "var(--border-medium)",
          accent: "var(--border-accent)",
          "accent-strong": "var(--border-accent-strong)",
          danger: "var(--border-danger)",
          warning: "var(--border-warning)",
        },

        // Canvas entity colors (static — matches designTokens.ts)
        // Usage: text-entity-pill, bg-entity-token, etc. (for HUD/UI references only)
        entity: {
          ship: "var(--entity-ship)",
          "ship-glow": "var(--entity-ship-glow)",
          asteroid: "var(--entity-asteroid)",
          pill: "var(--entity-pill)",
          token: "var(--entity-token)",
          "ship-pickup": "var(--entity-ship-pickup)",
          shield: "var(--entity-shield)",
          rapidfire: "var(--entity-rapidfire)",
          particle: "var(--entity-particle)",
        },
      },

      fontSize: {
        // Named arcade sizes for consistent type scale
        xxs: ["9px", { lineHeight: "1.4" }],
        "xs-arcade": ["10px", { lineHeight: "1.5" }],
        "sm-arcade": ["11px", { lineHeight: "1.5" }],
      },

      fontFamily: {
        arcade: ['"Press Start 2P"', "monospace"],
        mono: ['"JetBrains Mono"', "monospace"],
      },

      animation: {
        fadeIn: "fadeIn 0.5s ease-out",
        glow: "glow 1.5s ease-in-out infinite alternate",
        blink: "blink 1s infinite",
        pulse: "pulse 0.2s ease-in-out",
        scale: "scale 0.2s ease-in-out",
        flicker: "flicker 1.6s linear infinite",
      },

      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(-20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        glow: {
          from: { textShadow: "var(--text-shadow-accent-glow)" },
          to: { textShadow: "var(--text-shadow-accent-glow)" },
        },
        blink: {
          "0%, 100%": { opacity: "0" },
          "50%": { opacity: "1" },
        },
        countdownPulse: {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "50%": { transform: "scale(1.2)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "0" },
        },
        countdownExpand: {
          "0%": { transform: "scale(1)", opacity: "0.5" },
          "100%": { transform: "scale(2)", opacity: "0" },
        },
        readyGoPulse: {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "50%": { transform: "scale(1.1)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        pulse: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
        scale: {
          "0%": { transform: "scale(1)" },
          "100%": { transform: "scale(1.1)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "4%": { opacity: "0.3" },
          "5%": { opacity: "1" },
          "8%": { opacity: "0.8" },
          "30%": { opacity: "1" },
          "48%": { opacity: "0.15" },
          "49%": { opacity: "1" },
          "52%": { opacity: "0.6" },
          "53%": { opacity: "1" },
          "78%": { opacity: "1" },
          "80%": { opacity: "0.35" },
          "81%": { opacity: "1" },
          "90%": { opacity: "0.85" },
          "91%": { opacity: "0.2" },
          "92%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

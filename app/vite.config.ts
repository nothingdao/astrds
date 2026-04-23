import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite-plus'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [react(), visualizer()],

  server: {
    port: 3000,
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
  },

  resolve: {
    alias: {
      '@': '/src',
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },

  publicDir: 'public',

  lint: {
    ignorePatterns: ['dist/**', 'netlify/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },

  fmt: {
    ignorePatterns: ['dist/**', 'netlify/**'],
    singleQuote: true,
    semi: false,
    sortPackageJson: true,
  },

  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },

  run: {
    enablePrePostScripts: true,
    tasks: {
      build: {
        command: 'vp build',
        input: ['src/**', 'public/**', 'index.html', 'vite.config.ts'],
      },
      check: {
        command: 'vp check',
        input: ['src/**'],
      },
    },
  },

  staged: {
    '*.{ts,tsx}': 'vp check --fix',
  },
})

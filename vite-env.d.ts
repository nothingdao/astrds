/// <reference types="vite/client" />

interface ImportMeta {
  readonly env: {
    readonly VITE_HELIUS_API_KEY: string
  }
}

declare module '*.json' {
  const value: any
  export default value
}

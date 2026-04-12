// src/index.tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider } from 'convex/react'
import { convex } from './lib/convex'
import App from './App'
import './styles/style.css'
import '@solana/wallet-adapter-react-ui/styles.css'

const container = document.getElementById('root')!
const root = createRoot(container)

root.render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </React.StrictMode>
)

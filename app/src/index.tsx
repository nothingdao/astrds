// src/index.tsx
import './polyfills'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider } from 'convex/react'
import { convex } from './lib/convex'
import App from './App'
import './styles/style.css'

const container = document.getElementById('root')!
const root = createRoot(container)

root.render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </React.StrictMode>
)

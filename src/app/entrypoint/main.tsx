import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { registerServiceWorker } from '@/shared/pwa'

import { App } from './App'
import '../styles/index.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element #root not found')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerServiceWorker()

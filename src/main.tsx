import '@fontsource/patrick-hand'
import '@fontsource/permanent-marker'
import './index.css'

import { Profiler, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { trackCanvases } from './dev/canvasMemory'
import { countCommit } from './dev/commits'

const root = document.getElementById('root')
if (!root)
  throw new Error('main: the #root element is missing, so the app cannot start')

// Dev only: the perf report counts canvas memory and React commits from the start.
if (import.meta.env.DEV) trackCanvases()

createRoot(root).render(
  <StrictMode>
    {import.meta.env.DEV ? (
      <Profiler id="app" onRender={countCommit}>
        <App />
      </Profiler>
    ) : (
      <App />
    )}
  </StrictMode>
)

import type { ProfilerOnRenderCallback } from 'react'

/** Dev only: React commits since the page loaded, counted by a `Profiler` in `main.tsx`. */
export const commits = { count: 0 }

/** The `Profiler` callback: counts one commit. */
export const countCommit: ProfilerOnRenderCallback = () => {
  commits.count++
}
